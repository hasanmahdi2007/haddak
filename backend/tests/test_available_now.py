"""The "Available now" feature: the owner's switch, its expiry, and the search filters."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import auth_headers, make_category, make_provider, search

AVAILABLE_URL = "/api/v1/me/provider/available"

# Monday 16 November 2026, 10:00 UTC (12:00 in Beirut).
NOW = datetime(2026, 11, 16, 10, 0, tzinfo=UTC)


@pytest.fixture
def frozen_now(monkeypatch):
    """Pin the clock that the routes and views read; returns a setter."""
    current = {"now": NOW}
    monkeypatch.setattr("app.services.provider_views.current_time", lambda: current["now"])

    def set_now(moment: datetime) -> None:
        current["now"] = moment

    return set_now


@pytest.mark.parametrize("hours", [2, 4, 8])
def test_switch_on_sets_available_until(client, db, frozen_now, hours):
    owner = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=owner)

    response = client.put(AVAILABLE_URL, json={"hours": hours}, headers=auth_headers(owner))

    assert response.status_code == 200, response.text
    body = response.json()
    assert datetime.fromisoformat(body["available_until"]) == NOW + timedelta(hours=hours)
    assert body["available_now"] is True


@pytest.mark.parametrize("hours", [0, 1, 3, 24, "two"])
def test_only_2_4_or_8_hours(client, db, hours):
    owner = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=owner)

    response = client.put(AVAILABLE_URL, json={"hours": hours}, headers=auth_headers(owner))

    assert response.status_code == 422


def test_needs_login_and_a_profile(client):
    assert client.put(AVAILABLE_URL, json={"hours": 2}).status_code == 401
    assert client.delete(AVAILABLE_URL).status_code == 401
    headers = auth_headers(uuid.uuid4())
    assert client.put(AVAILABLE_URL, json={"hours": 2}, headers=headers).status_code == 404
    assert client.delete(AVAILABLE_URL, headers=headers).status_code == 404


def test_it_turns_itself_off_and_can_be_switched_off(client, db, frozen_now):
    owner = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner)
    headers = auth_headers(owner)
    client.put(AVAILABLE_URL, json={"hours": 2}, headers=headers)

    def public_available_now() -> bool:
        return client.get(f"/api/v1/providers/{provider.id}").json()["available_now"]

    assert public_available_now() is True
    assert search(client)["items"][0]["available_now"] is True

    # Two hours later it has run out on its own.
    frozen_now(NOW + timedelta(hours=2))
    assert public_available_now() is False

    # Switched on again, then off by hand.
    client.put(AVAILABLE_URL, json={"hours": 4}, headers=headers)
    assert public_available_now() is True
    assert client.delete(AVAILABLE_URL, headers=headers).status_code == 204
    assert public_available_now() is False
    assert client.get("/api/v1/me/provider", headers=headers).json()["available_until"] is None
    # Switching off twice is fine.
    assert client.delete(AVAILABLE_URL, headers=headers).status_code == 204


def test_available_now_filter(client, db, frozen_now):
    plumber = make_category(db, "plumber")
    available = make_provider(db, plumber, "Available", distance_m=100)
    make_provider(db, plumber, "Not available", distance_m=200)
    expired = make_provider(db, plumber, "Expired", distance_m=300)
    available.available_until = NOW + timedelta(hours=1)
    expired.available_until = NOW - timedelta(minutes=1)
    db.commit()

    body = search(client, available_now="true")

    assert [item["name"] for item in body["items"]] == ["Available"]
    assert body["total"] == 1


def test_open_now_also_keeps_available_providers(client, db, frozen_now):
    plumber = make_category(db, "plumber")
    # Beirut 12:00 on a Monday: open from 09:00 to 13:00.
    morning = {"mon": [["09:00", "13:00"]]}
    afternoon = {"mon": [["15:00", "19:00"]]}
    make_provider(db, plumber, "Open", distance_m=100, opening_hours=morning)
    make_provider(db, plumber, "Closed", distance_m=200, opening_hours=afternoon)
    closed_but_available = make_provider(
        db, plumber, "Closed but available", distance_m=300, opening_hours=afternoon
    )
    no_hours_available = make_provider(db, plumber, "No hours, available", distance_m=400)
    make_provider(db, plumber, "No hours", distance_m=500)
    closed_but_available.available_until = NOW + timedelta(hours=2)
    no_hours_available.available_until = NOW + timedelta(hours=2)
    db.commit()

    names = {item["name"] for item in search(client, open_now="true")["items"]}

    assert names == {"Open", "Closed but available", "No hours, available"}
