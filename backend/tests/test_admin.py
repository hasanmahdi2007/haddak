"""Admin endpoints: the key is required; verifying gives a profile the badge."""

import uuid
from datetime import UTC, datetime, timedelta

from tests.conftest import ADMIN_HEADERS, make_category, make_provider, search

ADMIN_URL = "/api/v1/admin/providers"


def test_admin_routes_need_the_right_key(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="pending")
    patch_url = f"{ADMIN_URL}/{provider.id}"
    body = {"status": "verified"}

    # No key at all
    assert client.get(ADMIN_URL).status_code == 401
    assert client.patch(patch_url, json=body).status_code == 401

    # Wrong key
    wrong = {"X-Admin-Key": "wrong-key"}
    assert client.get(ADMIN_URL, headers=wrong).status_code == 401
    assert client.patch(patch_url, json=body, headers=wrong).status_code == 401

    # Nothing changed: still listed without the badge
    assert client.get(f"/api/v1/providers/{provider.id}").json()["verified"] is False


def test_list_by_status_shows_private_fields(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "waiting", status="pending")
    make_provider(db, category, "live", status="verified")

    pending = client.get(ADMIN_URL, params={"status": "pending"}, headers=ADMIN_HEADERS).json()
    verified = client.get(ADMIN_URL, params={"status": "verified"}, headers=ADMIN_HEADERS).json()

    assert [item["name"] for item in pending["items"]] == ["waiting"]
    assert pending["total"] == 1
    assert pending["items"][0]["status"] == "pending"
    assert pending["items"][0]["verification_doc_url"] == "https://example.com/private/proof.pdf"
    assert [item["name"] for item in verified["items"]] == ["live"]


def test_list_rejects_unknown_status(client):
    response = client.get(ADMIN_URL, params={"status": "banana"}, headers=ADMIN_HEADERS)
    assert response.status_code == 422


def test_verifying_gives_the_badge_and_a_place_in_the_default_search(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="pending")
    public_url = f"/api/v1/providers/{provider.id}"
    # Before: listed, but without the badge and not in the default search.
    assert client.get(public_url).json()["verified"] is False
    assert search(client)["total"] == 0

    response = client.patch(
        f"{ADMIN_URL}/{provider.id}", json={"status": "verified"}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["status"] == "verified"
    assert client.get(public_url).json()["verified"] is True
    assert search(client)["total"] == 1


def test_rejecting_hides_a_public_profile_again(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="verified")

    client.patch(f"{ADMIN_URL}/{provider.id}", json={"status": "rejected"}, headers=ADMIN_HEADERS)

    assert client.get(f"/api/v1/providers/{provider.id}").status_code == 404


def test_admin_sets_featured_and_founding_member(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    next_month = (datetime.now(UTC).date() + timedelta(days=30)).isoformat()

    response = client.patch(
        f"{ADMIN_URL}/{provider.id}",
        json={"featured_until": next_month, "founding_member": True},
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["featured_until"] == next_month
    assert response.json()["status"] == "verified"  # not sent, so not changed
    item = search(client)["items"][0]
    assert item["featured"] is True
    assert item["founding_member"] is True

    # null removes "featured"
    client.patch(f"{ADMIN_URL}/{provider.id}", json={"featured_until": None}, headers=ADMIN_HEADERS)
    assert search(client)["items"][0]["featured"] is False


def test_admin_patch_validation_and_404(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    bad_status = client.patch(
        f"{ADMIN_URL}/{provider.id}", json={"status": "banana"}, headers=ADMIN_HEADERS
    )
    unknown = client.patch(
        f"{ADMIN_URL}/{uuid.uuid4()}", json={"status": "verified"}, headers=ADMIN_HEADERS
    )

    assert bad_status.status_code == 422
    assert unknown.status_code == 404
