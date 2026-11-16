"""Structured prices, and the search filters added with them: max_price,
open_now and sort."""

import uuid
from datetime import UTC, datetime

from tests.conftest import (
    ADMIN_HEADERS,
    auth_headers,
    make_category,
    make_provider,
    search,
    valid_provider_body,
)

ME_URL = "/api/v1/me/provider"


def names(result: dict) -> list[str]:
    return [item["name"] for item in result["items"]]


def beirut_monday(hour: int, minute: int = 0) -> datetime:
    # 2026-11-16 is a Monday; Beirut is UTC+2 in November.
    return datetime(2026, 11, 16, hour - 2, minute, tzinfo=UTC)


# ---------- storing prices ----------


def test_create_with_a_structured_price(client, db):
    category = make_category(db, "math-tutoring")

    response = client.post(
        ME_URL,
        json=valid_provider_body(category.id, price_amount=15, price_unit="hour"),
        headers=auth_headers(uuid.uuid4()),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["price_amount"] == 15
    assert body["price_unit"] == "hour"
    assert body["price_currency"] == "USD"  # the default


def test_without_a_structured_price_the_fields_are_empty(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category)

    item = search(client)["items"][0]

    assert item["price_amount"] is None
    assert item["price_unit"] is None
    assert item["price_currency"] == "USD"


def test_amount_and_unit_must_come_together_on_create(client, db):
    category = make_category(db, "plumber")
    for extra in ({"price_amount": 10}, {"price_unit": "job"}):
        response = client.post(
            ME_URL,
            json=valid_provider_body(category.id, **extra),
            headers=auth_headers(uuid.uuid4()),
        )
        assert response.status_code == 422
        assert "price_amount and price_unit" in response.json()["detail"]


def test_bad_price_values_are_422(client, db):
    category = make_category(db, "plumber")
    for extra in (
        {"price_amount": 0, "price_unit": "job"},
        {"price_amount": -5, "price_unit": "job"},
        {"price_amount": 10, "price_unit": "week"},
        {"price_amount": 10, "price_unit": "job", "price_currency": "EUR"},
    ):
        response = client.post(
            ME_URL,
            json=valid_provider_body(category.id, **extra),
            headers=auth_headers(uuid.uuid4()),
        )
        assert response.status_code == 422, extra


def test_patch_checks_the_pair_against_what_is_stored(client, db):
    category = make_category(db, "plumber")
    owner = uuid.uuid4()
    make_provider(db, category, owner_user_id=owner, price_amount=20, price_unit="visit")
    headers = auth_headers(owner)

    # Changing only the amount keeps the stored unit: fine.
    changed = client.patch(ME_URL, json={"price_amount": 25}, headers=headers)
    assert changed.status_code == 200
    assert changed.json()["price_amount"] == 25
    assert changed.json()["price_unit"] == "visit"

    # Clearing only the unit would leave an amount without a unit.
    half_cleared = client.patch(ME_URL, json={"price_unit": None}, headers=headers)
    assert half_cleared.status_code == 422

    # Clearing both is allowed.
    cleared = client.patch(ME_URL, json={"price_amount": None, "price_unit": None}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["price_amount"] is None

    # The currency cannot be null.
    assert client.patch(ME_URL, json={"price_currency": None}, headers=headers).status_code == 422


def test_admin_can_set_a_structured_price(client, db):
    category = make_category(db, "plumber")
    provider = make_provider(db, category)

    response = client.patch(
        f"/api/v1/admin/providers/{provider.id}",
        json={"price_amount": 500000, "price_unit": "visit", "price_currency": "LBP"},
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["price_amount"] == 500000
    assert response.json()["price_currency"] == "LBP"


# ---------- max_price ----------


def test_max_price_keeps_cheap_enough_providers_in_that_unit_and_currency(client, db):
    tutoring = make_category(db, "math-tutoring")
    make_provider(db, tutoring, "15 per hour", price_amount=15, price_unit="hour")
    make_provider(db, tutoring, "20 per hour", price_amount=20, price_unit="hour")
    make_provider(db, tutoring, "25 per hour", price_amount=25, price_unit="hour")
    make_provider(db, tutoring, "10 per month", price_amount=10, price_unit="month")
    make_provider(db, tutoring, "LBP per hour", price_amount=15, price_unit="hour",
                  price_currency="LBP")  # fmt: skip
    make_provider(db, tutoring, "no price")

    result = search(client, max_price=20, price_unit="hour")

    assert sorted(names(result)) == ["15 per hour", "20 per hour"]


def test_max_price_in_lbp(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "cheap", price_amount=400000, price_unit="job",
                  price_currency="LBP")  # fmt: skip
    make_provider(db, category, "dear", price_amount=900000, price_unit="job",
                  price_currency="LBP")  # fmt: skip

    result = search(client, max_price=500000, price_unit="job", price_currency="LBP")

    assert names(result) == ["cheap"]


def test_max_price_needs_a_unit(client, db):
    response = client.get(
        "/api/v1/providers/search",
        params={"lat": 33.85, "lng": 35.5, "radius_m": 500, "max_price": 20},
    )
    assert response.status_code == 422
    assert "price_unit" in response.json()["detail"]


def test_price_unit_alone_is_ignored(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "no price")

    assert names(search(client, price_unit="hour")) == ["no price"]


# ---------- open_now ----------


def test_open_now_keeps_only_providers_open_at_this_moment(client, db, monkeypatch):
    category = make_category(db, "dentist")
    morning = {"mon": [["09:00", "13:00"]]}
    evening = {"mon": [["17:00", "21:00"]]}
    make_provider(db, category, "morning clinic", opening_hours=morning)
    make_provider(db, category, "evening clinic", opening_hours=evening)
    make_provider(db, category, "no hours")
    monkeypatch.setattr("app.services.provider_views.current_time", lambda: beirut_monday(10, 30))

    assert names(search(client, open_now=True)) == ["morning clinic"]
    assert len(search(client)["items"]) == 3  # without the filter


def test_open_now_uses_beirut_time_and_the_closing_minute_is_closed(client, db, monkeypatch):
    category = make_category(db, "dentist")
    make_provider(db, category, "clinic", opening_hours={"mon": [["09:00", "13:00"]]})

    monkeypatch.setattr("app.services.provider_views.current_time", lambda: beirut_monday(13, 0))
    assert names(search(client, open_now=True)) == []

    monkeypatch.setattr("app.services.provider_views.current_time", lambda: beirut_monday(9, 0))
    assert names(search(client, open_now=True)) == ["clinic"]


# ---------- sort ----------


def test_sort_distance_is_nearest_first_but_verified_still_first(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "far but great", distance_m=400, avg_rating=5, review_count=50)
    make_provider(db, category, "near", distance_m=100)
    make_provider(db, category, "nearest unverified", distance_m=50, status="unverified")

    result = search(client, sort="distance", include_unverified=True)

    assert names(result) == ["near", "far but great", "nearest unverified"]


def test_sort_price_is_cheapest_first_then_the_usual_order(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "no price", avg_rating=5, review_count=50)
    make_provider(db, category, "30", price_amount=30, price_unit="job")
    make_provider(db, category, "10", price_amount=10, price_unit="job")

    assert names(search(client, sort="price")) == ["10", "30", "no price"]
    # The default order puts the best rated first.
    assert names(search(client))[0] == "no price"


def test_unknown_sort_is_422(client):
    response = client.get(
        "/api/v1/providers/search",
        params={"lat": 33.85, "lng": 35.5, "radius_m": 500, "sort": "rating"},
    )
    assert response.status_code == 422
