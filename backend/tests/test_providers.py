"""Public provider detail, share-code lookup and contact events."""

import uuid

import pytest
from sqlalchemy import func, select

from app.models import ContactEvent
from tests.conftest import CENTER_LAT, CENTER_LNG, make_category, make_provider

PRIVATE_FIELDS = {"status", "owner_user_id", "verification_doc_url", "featured_until"}


def test_detail_of_verified_provider(client, db):
    provider = make_provider(db, make_category(db, "plumber"), "Abu Hassan Plumbing")

    response = client.get(f"/api/v1/providers/{provider.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Abu Hassan Plumbing"
    assert body["phone"] == "+96170123456"
    assert body["whatsapp"] == "+96170123456"  # null in the database -> same as phone
    assert body["photos"] == ["https://example.com/cover.jpg", "https://example.com/second.jpg"]
    assert body["distance_m"] is None
    assert body["created_at"].endswith("Z")
    assert PRIVATE_FIELDS.isdisjoint(body)


def test_detail_includes_distance_when_position_is_sent(client, db):
    provider = make_provider(db, make_category(db, "plumber"), distance_m=730, bearing_deg=120)

    response = client.get(
        f"/api/v1/providers/{provider.id}", params={"lat": CENTER_LAT, "lng": CENTER_LNG}
    )

    assert response.json()["distance_m"] == 730


def test_by_slug_returns_the_same_provider(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    response = client.get(f"/api/v1/providers/by-slug/{provider.slug}")

    assert response.status_code == 200
    assert response.json()["id"] == str(provider.id)


@pytest.mark.parametrize("status", ["pending", "rejected"])
def test_unverified_profiles_are_404_everywhere_publicly(client, db, status):
    provider = make_provider(db, make_category(db, "plumber"), status=status)
    base = f"/api/v1/providers/{provider.id}"

    assert client.get(base).status_code == 404
    assert client.get(f"/api/v1/providers/by-slug/{provider.slug}").status_code == 404
    assert client.get(f"{base}/reviews").status_code == 404
    assert client.post(f"{base}/contact-events", json={"type": "view"}).status_code == 404


def test_unknown_provider_is_404(client):
    assert client.get(f"/api/v1/providers/{uuid.uuid4()}").status_code == 404
    assert client.get("/api/v1/providers/by-slug/nope").status_code == 404


def test_contact_event_is_stored_without_login(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    response = client.post(
        f"/api/v1/providers/{provider.id}/contact-events", json={"type": "whatsapp"}
    )

    assert response.status_code == 204
    stored = db.scalar(
        select(func.count())
        .select_from(ContactEvent)
        .where(ContactEvent.provider_id == provider.id, ContactEvent.type == "whatsapp")
    )
    assert stored == 1


def test_contact_event_type_is_validated(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    response = client.post(
        f"/api/v1/providers/{provider.id}/contact-events", json={"type": "email"}
    )

    assert response.status_code == 422
