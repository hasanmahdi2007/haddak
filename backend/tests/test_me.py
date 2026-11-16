"""Login tokens and the owner's own profile: create, read, update, stats."""

import uuid
from datetime import UTC, datetime

import pytest

from tests.conftest import (
    auth_headers,
    make_category,
    make_provider,
    make_token,
    valid_provider_body,
)

ME_URL = "/api/v1/me/provider"


# ---------- tokens ----------


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", ME_URL),
        ("POST", ME_URL),
        ("PATCH", ME_URL),
        ("GET", ME_URL + "/stats"),
        ("PUT", f"/api/v1/providers/{uuid.uuid4()}/reviews/mine"),
        ("DELETE", f"/api/v1/providers/{uuid.uuid4()}/reviews/mine"),
    ],
)
def test_auth_routes_need_a_token(client, method, path):
    response = client.request(method, path)
    assert response.status_code == 401
    assert isinstance(response.json()["detail"], str)


def test_bad_tokens_are_rejected(client):
    user_id = uuid.uuid4()
    bad_tokens = [
        "not-a-token",
        make_token(user_id, secret="a-different-secret-of-sufficient-length-123"),
        make_token(user_id, expired=True),
    ]
    for token in bad_tokens:
        response = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


# ---------- create ----------


def test_create_profile_with_proof_starts_pending_and_listed_without_badge(client, db):
    category = make_category(db, "laptop-repair")
    headers = auth_headers(uuid.uuid4())

    response = client.post(ME_URL, json=valid_provider_body(category.id), headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["verified"] is False
    assert body["founding_member"] is False
    assert body["featured_until"] is None
    assert body["verification_doc_url"] == "https://example.com/private/id.pdf"
    assert body["category"]["slug"] == "laptop-repair"
    assert body["lat"] == pytest.approx(33.8551)
    assert body["lng"] == pytest.approx(35.5102)
    assert len(body["slug"]) == 6

    # The owner can see it. So can the public, but without the badge and
    # without the private fields, until the admin verifies it.
    assert client.get(ME_URL, headers=headers).json()["id"] == body["id"]
    public = client.get(f"/api/v1/providers/{body['id']}")
    assert public.status_code == 200
    assert public.json()["verified"] is False
    assert public.json()["claimed"] is True
    assert "status" not in public.json()
    assert "verification_doc_url" not in public.json()


def test_owner_cannot_set_admin_fields_when_creating(client, db):
    category = make_category(db, "laptop-repair")
    body = valid_provider_body(
        category.id, status="verified", founding_member=True, featured_until="2099-01-01"
    )

    created = client.post(ME_URL, json=body, headers=auth_headers(uuid.uuid4())).json()

    assert created["status"] == "pending"
    assert created["founding_member"] is False
    assert created["featured_until"] is None


def test_second_profile_is_409(client, db):
    category = make_category(db, "laptop-repair")
    headers = auth_headers(uuid.uuid4())
    body = valid_provider_body(category.id)

    first = client.post(ME_URL, json=body, headers=headers)
    second = client.post(ME_URL, json=body, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 409


def test_get_without_profile_is_404(client):
    response = client.get(ME_URL, headers=auth_headers(uuid.uuid4()))
    assert response.status_code == 404


@pytest.mark.parametrize(
    "bad_phone",
    [
        "70123456",  # no plus sign
        "+961 70 123 456",  # spaces
        "+1234567",  # 7 digits: too short
        "+1234567890123456",  # 16 digits: too long
        "+9617012345a",  # a letter
        "0096170123456",  # 00 instead of +
    ],
)
def test_phone_must_be_international_format(client, db, bad_phone):
    category = make_category(db, "laptop-repair")
    headers = auth_headers(uuid.uuid4())

    as_phone = client.post(
        ME_URL, json=valid_provider_body(category.id, phone=bad_phone), headers=headers
    )
    as_whatsapp = client.post(
        ME_URL, json=valid_provider_body(category.id, whatsapp=bad_phone), headers=headers
    )

    assert as_phone.status_code == 422
    assert "phone" in as_phone.json()["detail"]
    assert as_whatsapp.status_code == 422


@pytest.mark.parametrize("good_phone", ["+96170123456", "+12345678", "+123456789012345"])
def test_valid_phones_are_accepted(client, db, good_phone):
    category = make_category(db, "laptop-repair")

    response = client.post(
        ME_URL,
        json=valid_provider_body(category.id, phone=good_phone, whatsapp=good_phone),
        headers=auth_headers(uuid.uuid4()),
    )

    assert response.status_code == 201
    assert response.json()["whatsapp"] == good_phone


def test_unknown_category_is_400(client):
    response = client.post(
        ME_URL, json=valid_provider_body(99999), headers=auth_headers(uuid.uuid4())
    )
    assert response.status_code == 400


# ---------- update ----------


def test_patch_changes_only_the_fields_sent(client, db):
    category = make_category(db, "laptop-repair")
    headers = auth_headers(uuid.uuid4())
    client.post(ME_URL, json=valid_provider_body(category.id), headers=headers)

    response = client.patch(
        ME_URL, json={"name": "Ali Tech 2", "lat": 33.86, "price_text": None}, headers=headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Ali Tech 2"
    assert body["price_text"] is None
    assert body["lat"] == pytest.approx(33.86)
    assert body["lng"] == pytest.approx(35.5102)  # untouched
    assert body["description"] == "Laptop and phone repair."  # untouched
    assert body["status"] == "pending"


def test_patch_validates_like_create(client, db):
    category = make_category(db, "laptop-repair")
    headers = auth_headers(uuid.uuid4())
    client.post(ME_URL, json=valid_provider_body(category.id), headers=headers)

    assert client.patch(ME_URL, json={"phone": "12345"}, headers=headers).status_code == 422
    assert client.patch(ME_URL, json={"name": None}, headers=headers).status_code == 422
    assert client.patch(ME_URL, json={"category_id": 99999}, headers=headers).status_code == 400


def test_patch_cannot_change_status(client, db):
    category = make_category(db, "laptop-repair")
    headers = auth_headers(uuid.uuid4())
    client.post(ME_URL, json=valid_provider_body(category.id), headers=headers)

    body = client.patch(ME_URL, json={"status": "verified"}, headers=headers).json()

    assert body["status"] == "pending"


def test_patch_without_profile_is_404(client):
    response = client.patch(ME_URL, json={"name": "x"}, headers=auth_headers(uuid.uuid4()))
    assert response.status_code == 404


# ---------- stats ----------


def test_contact_events_show_up_in_stats(client, db, clock):
    owner_id = uuid.uuid4()
    category = make_category(db, "laptop-repair")
    mine = make_provider(db, category, owner_user_id=owner_id)
    someone_else = make_provider(db, category)

    events = ["view", "view", "view", "whatsapp", "whatsapp", "call"]
    for event_type in events:
        client.post(f"/api/v1/providers/{mine.id}/contact-events", json={"type": event_type})
        # Repeats within 10 minutes are not counted, so let 11 minutes pass.
        clock.advance(11 * 60)
    client.post(f"/api/v1/providers/{someone_else.id}/contact-events", json={"type": "call"})

    response = client.get(ME_URL + "/stats", headers=auth_headers(owner_id))

    assert response.status_code == 200
    assert response.json() == {
        "month": datetime.now(UTC).strftime("%Y-%m"),
        "views": 3,
        "whatsapp": 2,
        "calls": 1,
        "confirmed_hires": 0,
    }


def test_stats_ignore_events_from_previous_months(client, db):
    from app.models import ContactEvent

    owner_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "laptop-repair"), owner_user_id=owner_id)
    db.add(
        ContactEvent(
            provider_id=provider.id, type="view", created_at=datetime(2020, 1, 15, tzinfo=UTC)
        )
    )
    db.commit()

    stats = client.get(ME_URL + "/stats", headers=auth_headers(owner_id)).json()

    assert stats["views"] == 0


def test_stats_without_profile_is_404(client):
    response = client.get(ME_URL + "/stats", headers=auth_headers(uuid.uuid4()))
    assert response.status_code == 404
