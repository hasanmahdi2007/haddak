"""Publishing a suggestion as an unverified listing with no owner."""

import uuid

import pytest
from sqlalchemy import func, select

from app.models import Provider, ProviderSuggestion
from tests.conftest import ADMIN_HEADERS, make_category, search

SUGGEST_URL = "/api/v1/suggestions"
ADMIN_URL = "/api/v1/admin/suggestions"

# A position inside the default 500 m test search circle.
LAT = 33.8551
LNG = 35.5102


def publish_url(suggestion_id) -> str:
    return f"{ADMIN_URL}/{suggestion_id}/publish"


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def make_full_suggestion(db, category) -> ProviderSuggestion:
    """A suggestion that already has everything a listing needs."""
    suggestion = ProviderSuggestion(
        name="Abu Ali Tailor",
        phone="+96170123456",
        category_id=category.id,
        area_name="Mazraa",
        note="Best tailor in the area.",
        lat=LAT,
        lng=LNG,
    )
    db.add(suggestion)
    db.commit()
    return suggestion


def make_name_only_suggestion(db) -> ProviderSuggestion:
    suggestion = ProviderSuggestion(name="Abu Ali Tailor")
    db.add(suggestion)
    db.commit()
    return suggestion


# ---------- position on a suggestion ----------


def test_suggestion_can_carry_a_position(client, db):
    response = client.post(SUGGEST_URL, json={"name": "Abu Ali Tailor", "lat": LAT, "lng": LNG})

    assert response.status_code == 201
    saved = db.get(ProviderSuggestion, uuid.UUID(response.json()["id"]))
    assert (saved.lat, saved.lng) == (pytest.approx(LAT), pytest.approx(LNG))
    listed = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()["items"][0]
    assert (listed["lat"], listed["lng"]) == (pytest.approx(LAT), pytest.approx(LNG))


@pytest.mark.parametrize(
    "bad_position",
    [
        {"lat": LAT},  # one without the other
        {"lng": LNG},
        {"lat": LAT, "lng": None},
        {"lat": 90.1, "lng": LNG},
        {"lat": -90.1, "lng": LNG},
        {"lat": LAT, "lng": 180.1},
        {"lat": LAT, "lng": -180.1},
        {"lat": "north", "lng": LNG},
    ],
)
def test_suggestion_position_is_validated(client, db, bad_position):
    response = client.post(SUGGEST_URL, json={"name": "Abu Ali Tailor", **bad_position})

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert count(db, ProviderSuggestion) == 0


# ---------- publish ----------


def test_publish_a_complete_suggestion_without_a_body(client, db):
    category = make_category(db, "tailor")
    suggestion = make_full_suggestion(db, category)

    response = client.post(publish_url(suggestion.id), headers=ADMIN_HEADERS)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Abu Ali Tailor"
    assert body["phone"] == "+96170123456"
    assert body["category"]["slug"] == "tailor"
    assert body["area_name"] == "Mazraa"
    assert body["lat"] == pytest.approx(LAT)
    assert body["lng"] == pytest.approx(LNG)
    assert body["status"] == "unverified"
    assert body["source"] == "suggestion"
    assert body["verified"] is False
    assert body["claimed"] is False
    assert body["verification_doc_url"] is None
    assert body["photos"] == []
    # The note was written for the admin: it is not published.
    assert body["description"] == ""
    assert len(body["slug"]) == 6  # a share code like any other profile's

    saved = db.get(Provider, uuid.UUID(body["id"]))
    assert saved.owner_user_id is None
    assert saved.source == "suggestion"


def test_publishing_removes_the_suggestion(client, db):
    category = make_category(db, "tailor")
    suggestion = make_full_suggestion(db, category)
    other = make_name_only_suggestion(db)

    client.post(publish_url(suggestion.id), headers=ADMIN_HEADERS)

    left = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()
    assert [item["id"] for item in left["items"]] == [str(other.id)]
    # Publishing the same suggestion again is 404 and makes no second listing.
    assert client.post(publish_url(suggestion.id), headers=ADMIN_HEADERS).status_code == 404
    assert count(db, Provider) == 1


def test_published_listing_is_public_but_only_with_include_unverified(client, db):
    category = make_category(db, "tailor")
    suggestion = make_full_suggestion(db, category)

    created = client.post(publish_url(suggestion.id), headers=ADMIN_HEADERS).json()

    detail = client.get(f"/api/v1/providers/{created['id']}")
    assert detail.status_code == 200
    assert detail.json()["claimed"] is False
    assert search(client)["total"] == 0
    with_unverified = search(client, include_unverified=True)
    assert [item["id"] for item in with_unverified["items"]] == [created["id"]]
    assert with_unverified["items"][0]["claimed"] is False


def test_body_supplies_everything_a_name_only_suggestion_lacks(client, db):
    category = make_category(db, "tailor")
    suggestion = make_name_only_suggestion(db)
    body = {
        "phone": "+96171000000",
        "category_id": category.id,
        "area_name": "  Mazraa  ",
        "lat": LAT,
        "lng": LNG,
        "description": "Alterations and repairs.",
    }

    response = client.post(publish_url(suggestion.id), json=body, headers=ADMIN_HEADERS)

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Abu Ali Tailor"  # kept from the suggestion
    assert created["phone"] == "+96171000000"
    assert created["area_name"] == "Mazraa"  # spaces around the text are removed
    assert created["description"] == "Alterations and repairs."
    assert count(db, ProviderSuggestion) == 0


def test_body_overrides_the_suggestion(client, db):
    tailor = make_category(db, "tailor")
    shoes = make_category(db, "shoe-repair")
    suggestion = make_full_suggestion(db, tailor)
    body = {
        "name": "Abu Ali Shoes",
        "phone": "+96171000000",
        "category_id": shoes.id,
        "area_name": "Hamra",
        "lat": 33.8960,
        "lng": 35.4780,
    }

    created = client.post(publish_url(suggestion.id), json=body, headers=ADMIN_HEADERS).json()

    assert created["name"] == "Abu Ali Shoes"
    assert created["phone"] == "+96171000000"
    assert created["category"]["slug"] == "shoe-repair"
    assert created["area_name"] == "Hamra"
    assert created["lat"] == pytest.approx(33.8960)
    assert created["lng"] == pytest.approx(35.4780)


def test_null_in_the_body_keeps_the_suggestion_value(client, db):
    suggestion = make_full_suggestion(db, make_category(db, "tailor"))

    response = client.post(
        publish_url(suggestion.id), json={"name": None, "phone": None}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Abu Ali Tailor"
    assert response.json()["phone"] == "+96170123456"


def test_missing_fields_are_422_and_named(client, db):
    suggestion = make_name_only_suggestion(db)

    nothing_sent = client.post(publish_url(suggestion.id), headers=ADMIN_HEADERS)
    some_sent = client.post(
        publish_url(suggestion.id),
        json={"phone": "+96171000000", "area_name": "Mazraa", "lat": LAT},
        headers=ADMIN_HEADERS,
    )

    assert nothing_sent.status_code == 422
    assert nothing_sent.json() == {"detail": "Missing: phone, category_id, area_name, lat, lng"}
    assert some_sent.status_code == 422
    assert some_sent.json() == {"detail": "Missing: category_id, lng"}
    # Nothing happened: no listing, and the suggestion is still there.
    assert count(db, Provider) == 0
    assert count(db, ProviderSuggestion) == 1


@pytest.mark.parametrize(
    "bad_body",
    [
        {"phone": "12345"},
        {"name": ""},
        {"name": "x" * 101},
        {"area_name": "x" * 101},
        {"description": "x" * 2001},
        {"lat": 91},
        {"lng": -181},
        {"category_id": "tailor"},
    ],
)
def test_publish_body_is_validated(client, db, bad_body):
    suggestion = make_full_suggestion(db, make_category(db, "tailor"))

    response = client.post(publish_url(suggestion.id), json=bad_body, headers=ADMIN_HEADERS)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert count(db, Provider) == 0
    assert count(db, ProviderSuggestion) == 1


def test_unknown_category_is_400_and_unknown_suggestion_is_404(client, db):
    suggestion = make_full_suggestion(db, make_category(db, "tailor"))

    bad_category = client.post(
        publish_url(suggestion.id), json={"category_id": 99999}, headers=ADMIN_HEADERS
    )
    unknown = client.post(publish_url(uuid.uuid4()), headers=ADMIN_HEADERS)

    assert bad_category.status_code == 400
    assert unknown.status_code == 404
    assert count(db, Provider) == 0
    assert count(db, ProviderSuggestion) == 1


def test_publish_needs_the_admin_key(client, db):
    suggestion = make_full_suggestion(db, make_category(db, "tailor"))
    url = publish_url(suggestion.id)

    assert client.post(url).status_code == 401
    assert client.post(url, headers={"X-Admin-Key": "wrong-key"}).status_code == 401
    assert count(db, Provider) == 0
    assert count(db, ProviderSuggestion) == 1


def test_published_listing_can_be_verified_by_the_admin(client, db):
    suggestion = make_full_suggestion(db, make_category(db, "tailor"))
    created = client.post(publish_url(suggestion.id), headers=ADMIN_HEADERS).json()

    response = client.patch(
        f"/api/v1/admin/providers/{created['id']}",
        json={"status": "verified"},
        headers=ADMIN_HEADERS,
    )

    assert response.json()["verified"] is True
    assert response.json()["claimed"] is False
    assert search(client)["total"] == 1


def test_admin_page_has_the_publish_action(client):
    page = client.get("/admin").text

    assert "Publish" in page
    assert "/publish" in page
    assert "Decline proof" in page
    assert "Restore" in page
    assert "Unverified" in page
    assert "innerHTML" not in page
