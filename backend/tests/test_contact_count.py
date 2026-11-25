"""The optional public "contacts this month" number on a provider's profile."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.models import ContactEvent
from tests.conftest import (
    auth_headers,
    make_category,
    make_provider,
    search,
    valid_provider_body,
)

ME_URL = "/api/v1/me/provider"


def add_events(db, provider, event_types: list[str], created_at: datetime | None = None) -> None:
    """Insert contact events directly (skips the API's 10-minute de-duplication).

    WhatsApp and call taps are stored as signed-in taps that count publicly."""
    for event_type in event_types:
        event = ContactEvent(
            provider_id=provider.id,
            type=event_type,
            counts_publicly=event_type in ("whatsapp", "call"),
        )
        if created_at is not None:
            event.created_at = created_at
        db.add(event)
    db.commit()


def test_count_is_hidden_by_default_but_still_counted(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    client.post(f"/api/v1/providers/{provider.id}/contact-events", json={"type": "call"})

    body = client.get(f"/api/v1/providers/{provider.id}").json()

    assert body["contacts_this_month"] is None
    assert "show_contact_count" not in body  # the switch itself is owner-only
    # Counting is always on, whatever the switch says.
    assert db.scalar(select(func.count()).select_from(ContactEvent)) == 1


def test_count_is_shown_when_the_provider_switched_it_on(client, db):
    category = make_category(db, "plumber")
    provider = make_provider(db, category, show_contact_count=True)
    other = make_provider(db, category, show_contact_count=True)
    add_events(db, provider, ["whatsapp", "whatsapp", "call"])
    add_events(db, other, ["call"])

    by_id = client.get(f"/api/v1/providers/{provider.id}").json()
    by_slug = client.get(f"/api/v1/providers/by-slug/{provider.slug}").json()

    assert by_id["contacts_this_month"] == 3  # the other provider's call is not included
    assert by_slug["contacts_this_month"] == 3


def test_count_is_zero_not_null_when_shown_and_nobody_called(client, db):
    provider = make_provider(db, make_category(db, "plumber"), show_contact_count=True)

    assert client.get(f"/api/v1/providers/{provider.id}").json()["contacts_this_month"] == 0


def test_count_excludes_views(client, db):
    provider = make_provider(db, make_category(db, "plumber"), show_contact_count=True)
    add_events(db, provider, ["view", "view", "view", "whatsapp", "call"])

    assert client.get(f"/api/v1/providers/{provider.id}").json()["contacts_this_month"] == 2


def test_count_excludes_other_months(client, db):
    provider = make_provider(db, make_category(db, "plumber"), show_contact_count=True)
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    add_events(db, provider, ["call"], created_at=month_start)  # first instant of this month
    add_events(db, provider, ["call"], created_at=month_start - timedelta(seconds=1))
    add_events(db, provider, ["whatsapp"], created_at=datetime(2020, 1, 15, tzinfo=UTC))

    assert client.get(f"/api/v1/providers/{provider.id}").json()["contacts_this_month"] == 1


def test_count_is_not_in_search_results(client, db):
    make_provider(db, make_category(db, "plumber"), show_contact_count=True)

    item = search(client)["items"][0]

    assert "contacts_this_month" not in item
    assert "show_contact_count" not in item


def test_owner_sets_the_switch_on_create(client, db):
    category = make_category(db, "plumber")
    headers = auth_headers(uuid.uuid4())

    default = client.post(
        ME_URL, json=valid_provider_body(category.id), headers=auth_headers(uuid.uuid4())
    ).json()
    switched_on = client.post(
        ME_URL, json=valid_provider_body(category.id, show_contact_count=True), headers=headers
    ).json()

    assert default["show_contact_count"] is False
    assert default["contacts_this_month"] is None
    assert switched_on["show_contact_count"] is True
    assert switched_on["contacts_this_month"] == 0
    assert client.get(ME_URL, headers=headers).json()["show_contact_count"] is True


def test_owner_switches_it_on_and_off_with_patch(client, db):
    owner_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)
    add_events(db, provider, ["call", "whatsapp"])
    headers = auth_headers(owner_id)
    public_url = f"/api/v1/providers/{provider.id}"

    on = client.patch(ME_URL, json={"show_contact_count": True}, headers=headers)
    assert on.status_code == 200
    assert on.json()["show_contact_count"] is True
    assert on.json()["contacts_this_month"] == 2
    assert client.get(public_url).json()["contacts_this_month"] == 2

    off = client.patch(ME_URL, json={"show_contact_count": False}, headers=headers)
    assert off.json()["show_contact_count"] is False
    assert client.get(public_url).json()["contacts_this_month"] is None


def test_switch_cannot_be_null_or_a_word(client, db):
    owner_id = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)
    headers = auth_headers(owner_id)

    assert (
        client.patch(ME_URL, json={"show_contact_count": None}, headers=headers).status_code == 422
    )
    assert (
        client.patch(ME_URL, json={"show_contact_count": "maybe"}, headers=headers).status_code
        == 422
    )
