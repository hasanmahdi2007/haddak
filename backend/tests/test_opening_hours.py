"""Opening hours: the pure "open now" function, validation, and the API fields.

The pure-function tests pass fixed moments, so they never depend on the real
clock. 2026-11-16 is a Monday; Beirut is UTC+2 in November and UTC+3 in July.
"""

import uuid
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest

from app.services.opening_hours import is_open_now
from tests.conftest import (
    auth_headers,
    make_category,
    make_provider,
    search,
    valid_provider_body,
)

BEIRUT = ZoneInfo("Asia/Beirut")
ME_URL = "/api/v1/me/provider"

HOURS = {
    "mon": [["09:00", "13:00"], ["15:00", "19:00"]],
    "sat": [["10:00", "14:00"]],
}


def beirut(day: int, hour: int, minute: int = 0) -> datetime:
    """A moment in November 2026, Beirut time. Day 16 is a Monday."""
    return datetime(2026, 11, day, hour, minute, tzinfo=BEIRUT)


# ---------- the pure function ----------


def test_open_inside_a_range():
    assert is_open_now(HOURS, beirut(16, 10, 30)) is True  # Monday morning
    assert is_open_now(HOURS, beirut(16, 16, 0)) is True  # Monday afternoon
    assert is_open_now(HOURS, beirut(21, 12, 0)) is True  # Saturday


def test_closed_outside_the_ranges():
    assert is_open_now(HOURS, beirut(16, 8, 0)) is False  # before opening
    assert is_open_now(HOURS, beirut(16, 14, 0)) is False  # lunch break
    assert is_open_now(HOURS, beirut(16, 22, 0)) is False  # evening


def test_boundaries_open_time_is_open_close_time_is_closed():
    assert is_open_now(HOURS, beirut(16, 8, 59)) is False
    assert is_open_now(HOURS, beirut(16, 9, 0)) is True
    assert is_open_now(HOURS, beirut(16, 12, 59)) is True
    assert is_open_now(HOURS, beirut(16, 13, 0)) is False
    assert is_open_now(HOURS, beirut(16, 15, 0)) is True
    assert is_open_now(HOURS, beirut(16, 19, 0)) is False


def test_missing_day_and_empty_day_are_closed():
    assert is_open_now(HOURS, beirut(17, 10, 30)) is False  # Tuesday: no key
    assert is_open_now({"mon": []}, beirut(16, 10, 30)) is False
    assert is_open_now({}, beirut(16, 10, 30)) is False  # hours given, never open


def test_no_hours_means_unknown():
    assert is_open_now(None, beirut(16, 10, 30)) is None


def test_the_moment_is_converted_to_beirut_time():
    # Winter (UTC+2): 07:30 UTC is 09:30 in Beirut -> open; 06:30 UTC is 08:30 -> closed.
    assert is_open_now(HOURS, datetime(2026, 11, 16, 7, 30, tzinfo=UTC)) is True
    assert is_open_now(HOURS, datetime(2026, 11, 16, 6, 30, tzinfo=UTC)) is False
    # Summer (UTC+3): 06:30 UTC is 09:30 in Beirut -> open. 2026-07-13 is a Monday.
    assert is_open_now(HOURS, datetime(2026, 7, 13, 6, 30, tzinfo=UTC)) is True


def test_the_day_is_the_beirut_day_not_the_utc_day():
    # Sunday 22:30 UTC is already Monday 00:30 in Beirut.
    night_shop = {"mon": [["00:00", "02:00"]]}
    assert is_open_now(night_shop, datetime(2026, 11, 15, 22, 30, tzinfo=UTC)) is True


# ---------- validation ----------


@pytest.mark.parametrize(
    "bad_hours",
    [
        {"monday": [["09:00", "13:00"]]},  # unknown day key
        {"mon": [["09:00", "13:00"]], "holiday": []},  # one good key, one unknown
        {"mon": [["09:00", "10:00"], ["11:00", "12:00"], ["13:00", "14:00"], ["15:00", "16:00"]]},
        {"mon": [["9:00", "13:00"]]},  # not HH:MM
        {"mon": [["09:00", "24:00"]]},  # no such time
        {"mon": [["09:60", "13:00"]]},
        {"mon": [["09:00", "1pm"]]},
        {"mon": [["13:00", "09:00"]]},  # close before open
        {"mon": [["22:00", "02:00"]]},  # overnight: not supported in v1
        {"mon": [["09:00", "09:00"]]},  # empty range
        {"mon": [["09:00"]]},  # not a pair
        {"mon": [["09:00", "13:00", "15:00"]]},
        {"mon": "09:00-13:00"},  # not a list
        [["09:00", "13:00"]],  # not an object
        "always",
    ],
)
def test_bad_opening_hours_are_422_on_create_and_update(client, db, bad_hours):
    category = make_category(db, "laptop-repair")
    owner_id = uuid.uuid4()
    make_provider(db, category, owner_user_id=owner_id)

    created = client.post(
        ME_URL,
        json=valid_provider_body(category.id, opening_hours=bad_hours),
        headers=auth_headers(uuid.uuid4()),
    )
    updated = client.patch(
        ME_URL, json={"opening_hours": bad_hours}, headers=auth_headers(owner_id)
    )

    assert created.status_code == 422
    assert updated.status_code == 422
    assert isinstance(updated.json()["detail"], str)


def test_longest_day_and_three_ranges_are_accepted(client, db):
    category = make_category(db, "laptop-repair")
    hours = {
        "mon": [["00:00", "23:59"]],
        "tue": [["08:00", "10:00"], ["11:00", "13:00"], ["15:00", "19:00"]],
        "sun": [],
    }

    response = client.post(
        ME_URL,
        json=valid_provider_body(category.id, opening_hours=hours),
        headers=auth_headers(uuid.uuid4()),
    )

    assert response.status_code == 201
    assert response.json()["opening_hours"] == hours


# ---------- through the API ----------


def test_create_without_hours_gives_null_hours_and_null_open_now(client, db):
    category = make_category(db, "laptop-repair")

    body = client.post(
        ME_URL, json=valid_provider_body(category.id), headers=auth_headers(uuid.uuid4())
    ).json()

    assert body["opening_hours"] is None
    assert body["open_now"] is None


def test_patch_sets_and_clears_hours(client, db):
    owner_id = uuid.uuid4()
    make_provider(db, make_category(db, "laptop-repair"), owner_user_id=owner_id)
    headers = auth_headers(owner_id)

    set_response = client.patch(ME_URL, json={"opening_hours": HOURS}, headers=headers)
    assert set_response.status_code == 200
    assert set_response.json()["opening_hours"] == HOURS
    assert set_response.json()["open_now"] in (True, False)

    # Another field changes; the hours stay.
    renamed = client.patch(ME_URL, json={"name": "New name"}, headers=headers).json()
    assert renamed["opening_hours"] == HOURS

    cleared = client.patch(ME_URL, json={"opening_hours": None}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["opening_hours"] is None
    assert cleared.json()["open_now"] is None


def test_detail_and_search_return_open_now(client, db, monkeypatch):
    category = make_category(db, "laptop-repair")
    with_hours = make_provider(db, category, "With hours", opening_hours=HOURS)
    without_hours = make_provider(db, category, "Without hours", distance_m=50)

    def open_now_by_name() -> dict:
        return {item["name"]: item["open_now"] for item in search(client)["items"]}

    # Pretend it is Monday 10:30 in Beirut.
    monkeypatch.setattr("app.services.provider_views.current_time", lambda: beirut(16, 10, 30))
    detail = client.get(f"/api/v1/providers/{with_hours.id}").json()
    assert detail["open_now"] is True
    assert detail["opening_hours"] == HOURS
    assert open_now_by_name() == {"With hours": True, "Without hours": None}

    # Monday 14:00: the lunch break.
    monkeypatch.setattr("app.services.provider_views.current_time", lambda: beirut(16, 14, 0))
    assert client.get(f"/api/v1/providers/{with_hours.id}").json()["open_now"] is False
    assert open_now_by_name() == {"With hours": False, "Without hours": None}

    no_hours_detail = client.get(f"/api/v1/providers/{without_hours.id}").json()
    assert no_hours_detail["opening_hours"] is None
    assert no_hours_detail["open_now"] is None
