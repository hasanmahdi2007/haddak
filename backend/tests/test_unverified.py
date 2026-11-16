"""Listed without being verified: statuses, admin transitions, search toggle."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import (
    ADMIN_HEADERS,
    auth_headers,
    make_category,
    make_provider,
    search,
    valid_provider_body,
)

ME_URL = "/api/v1/me/provider"
ADMIN_URL = "/api/v1/admin/providers"

NEW_PROOF = "https://example.com/private/new-proof.pdf"


def names(result: dict) -> list[str]:
    return [item["name"] for item in result["items"]]


def next_month():
    return datetime.now(UTC).date() + timedelta(days=30)


def create_profile(client, category, **overrides) -> dict[str, str]:
    """Create a profile through the API; returns the owner's auth headers."""
    headers = auth_headers(uuid.uuid4())
    body = valid_provider_body(category.id, **overrides)
    assert client.post(ME_URL, json=body, headers=headers).status_code == 201
    return headers


def set_status(client, provider_id, status: str) -> dict:
    response = client.patch(
        f"{ADMIN_URL}/{provider_id}", json={"status": status}, headers=ADMIN_HEADERS
    )
    assert response.status_code == 200, response.text
    return response.json()


# ---------- status when the owner creates or edits ----------


def test_create_with_proof_is_pending(client, db):
    category = make_category(db, "laptop-repair")
    headers = create_profile(client, category)

    assert client.get(ME_URL, headers=headers).json()["status"] == "pending"


@pytest.mark.parametrize("without_proof", [{"verification_doc_url": None}, "left out"])
def test_create_without_proof_is_unverified_and_listed(client, db, without_proof):
    category = make_category(db, "laptop-repair")
    body = valid_provider_body(category.id)
    if without_proof == "left out":
        del body["verification_doc_url"]
    else:
        body.update(without_proof)

    response = client.post(ME_URL, json=body, headers=auth_headers(uuid.uuid4()))

    assert response.status_code == 201
    created = response.json()
    assert created["status"] == "unverified"
    assert created["source"] == "owner"
    assert created["verified"] is False
    assert created["verification_doc_url"] is None
    # Listed right away, without the badge.
    public = client.get(f"/api/v1/providers/{created['id']}")
    assert public.status_code == 200
    assert public.json()["verified"] is False


def test_adding_proof_later_makes_an_unverified_profile_pending(client, db):
    category = make_category(db, "laptop-repair")
    headers = create_profile(client, category, verification_doc_url=None)

    body = client.patch(ME_URL, json={"verification_doc_url": NEW_PROOF}, headers=headers).json()

    assert body["status"] == "pending"
    assert body["verification_doc_url"] == NEW_PROOF


def test_other_edits_keep_an_unverified_profile_unverified(client, db):
    category = make_category(db, "laptop-repair")
    headers = create_profile(client, category, verification_doc_url=None)

    body = client.patch(ME_URL, json={"name": "New Name"}, headers=headers).json()

    assert body["status"] == "unverified"


def test_resending_a_declined_proof_does_not_queue_it_again(client, db):
    category = make_category(db, "laptop-repair")
    headers = create_profile(client, category)  # with proof -> pending
    me = client.get(ME_URL, headers=headers).json()
    set_status(client, me["id"], "unverified")  # the admin declines the proof

    # The app sends the whole form again, with the same proof link.
    same = client.patch(
        ME_URL,
        json={"name": "New Name", "verification_doc_url": me["verification_doc_url"]},
        headers=headers,
    ).json()
    assert same["status"] == "unverified"

    # A different proof is new work for the founder.
    different = client.patch(ME_URL, json={"verification_doc_url": NEW_PROOF}, headers=headers)
    assert different.json()["status"] == "pending"


def test_removing_the_proof_of_a_pending_profile_makes_it_unverified(client, db):
    category = make_category(db, "laptop-repair")
    headers = create_profile(client, category)

    body = client.patch(ME_URL, json={"verification_doc_url": None}, headers=headers).json()

    assert body["status"] == "unverified"


@pytest.mark.parametrize("status", ["verified", "rejected"])
def test_proof_changes_do_not_move_a_verified_or_rejected_profile(client, db, status):
    category = make_category(db, "laptop-repair")
    headers = create_profile(client, category)
    me = client.get(ME_URL, headers=headers).json()
    set_status(client, me["id"], status)

    new_proof = client.patch(ME_URL, json={"verification_doc_url": NEW_PROOF}, headers=headers)
    no_proof = client.patch(ME_URL, json={"verification_doc_url": None}, headers=headers)

    assert new_proof.json()["status"] == status
    assert no_proof.json()["status"] == status


# ---------- admin transitions ----------


def test_admin_declines_proof_and_the_listing_stays_visible(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="pending")

    body = set_status(client, provider.id, "unverified")

    assert body["status"] == "unverified"
    # The proof link is kept, so the founder can still see what was declined.
    assert body["verification_doc_url"] == "https://example.com/private/proof.pdf"
    public = client.get(f"/api/v1/providers/{provider.id}")
    assert public.status_code == 200
    assert public.json()["verified"] is False


def test_admin_verifies_an_unverified_profile(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="unverified")

    assert set_status(client, provider.id, "verified")["verified"] is True
    assert client.get(f"/api/v1/providers/{provider.id}").json()["verified"] is True


@pytest.mark.parametrize("status", ["unverified", "pending", "verified"])
def test_admin_rejects_from_any_public_status(client, db, status):
    provider = make_provider(db, make_category(db, "plumber"), status=status)

    assert set_status(client, provider.id, "rejected")["status"] == "rejected"

    assert client.get(f"/api/v1/providers/{provider.id}").status_code == 404
    assert search(client, include_unverified=True)["total"] == 0


def test_admin_restores_a_rejected_profile_as_unverified(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="rejected")
    assert client.get(f"/api/v1/providers/{provider.id}").status_code == 404

    body = set_status(client, provider.id, "unverified")

    assert body["status"] == "unverified"
    public = client.get(f"/api/v1/providers/{provider.id}")
    assert public.status_code == 200
    assert public.json()["verified"] is False
    assert search(client)["total"] == 0  # no badge, so not in the default search
    assert search(client, include_unverified=True)["total"] == 1


def test_admin_list_accepts_every_status(client, db):
    category = make_category(db, "plumber")
    for status in ("unverified", "pending", "verified", "rejected"):
        make_provider(db, category, f"one {status}", status=status)

    for status in ("unverified", "pending", "verified", "rejected"):
        body = client.get(ADMIN_URL, params={"status": status}, headers=ADMIN_HEADERS).json()
        assert [item["name"] for item in body["items"]] == [f"one {status}"]
        assert body["items"][0]["status"] == status
        assert body["total"] == 1


# ---------- reviews on a profile that is not verified ----------


@pytest.mark.parametrize("status", ["unverified", "pending"])
def test_profiles_that_are_not_verified_can_be_reviewed(client, db, status):
    provider = make_provider(db, make_category(db, "plumber"), status=status)

    response = client.put(
        f"/api/v1/providers/{provider.id}/reviews/mine",
        json={"rating": 4, "comment": "", "author_name": "Rana"},
        headers=auth_headers(uuid.uuid4()),
    )

    assert response.status_code == 200
    assert client.get(f"/api/v1/providers/{provider.id}").json()["review_count"] == 1


def test_rejected_profile_cannot_be_reviewed(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="rejected")

    response = client.put(
        f"/api/v1/providers/{provider.id}/reviews/mine",
        json={"rating": 4, "comment": "", "author_name": "Rana"},
        headers=auth_headers(uuid.uuid4()),
    )

    assert response.status_code == 404


# ---------- search: the "include unverified" switch ----------


def test_search_is_verified_only_by_default(client, db):
    category = make_category(db, "plumber")
    for status in ("verified", "unverified", "pending", "rejected"):
        make_provider(db, category, status, status=status)

    default = search(client)
    switched_off = search(client, include_unverified=False)

    assert names(default) == ["verified"]
    assert default["total"] == 1
    assert names(switched_off) == ["verified"]


def test_include_unverified_adds_unverified_and_pending_but_never_rejected(client, db):
    category = make_category(db, "plumber")
    for status in ("verified", "unverified", "pending", "rejected"):
        make_provider(db, category, status, status=status)

    result = search(client, include_unverified=True)

    assert sorted(names(result)) == ["pending", "unverified", "verified"]
    assert result["total"] == 3
    badge = {item["name"]: item["verified"] for item in result["items"]}
    assert badge == {"verified": True, "unverified": False, "pending": False}
    # Nothing in a search result tells 'pending' and 'unverified' apart.
    assert all("status" not in item for item in result["items"])


def test_all_verified_come_before_all_not_verified(client, db):
    category = make_category(db, "plumber")
    # The non-verified ones are better on every other rule: rating and distance.
    make_provider(db, category, "verified, no reviews, far", distance_m=450)
    make_provider(db, category, "verified, poor", distance_m=400, avg_rating=2.0, review_count=40)
    make_provider(
        db, category, "unverified, great", status="unverified",
        distance_m=10, avg_rating=5.0, review_count=80,
    )  # fmt: skip
    make_provider(
        db, category, "pending, good", status="pending",
        distance_m=20, avg_rating=4.5, review_count=80,
    )  # fmt: skip

    result = search(client, include_unverified=True)

    # Inside each group the usual order applies (weighted rating here).
    assert names(result) == [
        "verified, no reviews, far",
        "verified, poor",
        "unverified, great",
        "pending, good",
    ]


def test_inside_the_not_verified_group_the_usual_order_applies(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "far", status="unverified", distance_m=300)
    make_provider(db, category, "near", status="pending", distance_m=100)
    make_provider(
        db, category, "well rated", status="unverified",
        distance_m=400, avg_rating=4.8, review_count=20,
    )  # fmt: skip

    result = search(client, include_unverified=True)

    assert names(result) == ["well rated", "near", "far"]


def test_featured_is_ignored_for_providers_that_are_not_verified(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "verified plain", distance_m=300)
    make_provider(db, category, "verified featured", distance_m=400, featured_until=next_month())
    # Featured date set, better rating, nearer: without the badge none of it
    # lifts the provider above a verified one, or above its own group.
    make_provider(
        db, category, "unverified featured", status="unverified",
        distance_m=200, featured_until=next_month(),
    )  # fmt: skip
    make_provider(
        db, category, "pending better rated", status="pending",
        distance_m=250, avg_rating=4.9, review_count=30,
    )  # fmt: skip

    result = search(client, include_unverified=True)

    assert names(result) == [
        "verified featured",
        "verified plain",
        "pending better rated",
        "unverified featured",
    ]
    featured = {item["name"]: item["featured"] for item in result["items"]}
    assert featured["verified featured"] is True
    assert featured["unverified featured"] is False


def test_paging_and_filters_work_with_include_unverified(client, db):
    plumber = make_category(db, "plumber")
    barber = make_category(db, "barber")
    make_provider(db, plumber, "Ali verified")
    make_provider(db, plumber, "Ali unverified", status="unverified", distance_m=50)
    make_provider(db, plumber, "Ali far away", status="unverified", distance_m=900)
    make_provider(db, barber, "Ali barber", status="unverified")

    result = search(client, include_unverified=True, category_id=plumber.id, q="ali")
    second_page = search(
        client, include_unverified=True, category_id=plumber.id, q="ali", limit=1, offset=1
    )

    assert names(result) == ["Ali verified", "Ali unverified"]
    assert names(second_page) == ["Ali unverified"]
    assert second_page["total"] == 2


# ---------- claimed ----------


def test_claimed_is_false_for_a_listing_with_no_owner(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "owned", status="unverified")
    unclaimed = make_provider(
        db, category, "community", status="unverified", claimed=False, source="suggestion"
    )

    result = search(client, include_unverified=True)
    detail = client.get(f"/api/v1/providers/{unclaimed.id}").json()

    claimed = {item["name"]: item["claimed"] for item in result["items"]}
    assert claimed == {"owned": True, "community": False}
    assert detail["claimed"] is False
    assert "owner_user_id" not in detail
    assert "source" not in detail


def test_several_listings_can_have_no_owner_but_an_owner_has_one_profile(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "community 1", claimed=False, source="suggestion")
    make_provider(db, category, "community 2", claimed=False, source="suggestion")

    # One profile per user still holds for real owners.
    headers = auth_headers(uuid.uuid4())
    body = valid_provider_body(category.id)
    assert client.post(ME_URL, json=body, headers=headers).status_code == 201
    assert client.post(ME_URL, json=body, headers=headers).status_code == 409


def test_unclaimed_listing_can_be_reviewed_by_anyone_logged_in(client, db):
    provider = make_provider(
        db, make_category(db, "plumber"), status="unverified", claimed=False, source="suggestion"
    )

    response = client.put(
        f"/api/v1/providers/{provider.id}/reviews/mine",
        json={"rating": 5, "comment": "", "author_name": "Rana"},
        headers=auth_headers(uuid.uuid4()),
    )

    assert response.status_code == 200
