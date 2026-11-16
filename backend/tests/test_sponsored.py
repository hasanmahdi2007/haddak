"""Sponsored placement: the `sponsored` flag and the owner's sponsor_hook."""

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


def today():
    return datetime.now(UTC).date()


def next_month():
    return today() + timedelta(days=30)


def yesterday():
    return today() - timedelta(days=1)


def detail(client, provider) -> dict:
    return client.get(f"/api/v1/providers/{provider.id}").json()


def test_sponsored_provider_shows_the_flag_and_hook(client, db):
    category = make_category(db, "plumber")
    provider = make_provider(
        db, category, "sponsored", featured_until=next_month(), sponsor_hook="Fixed in an hour."
    )

    item = search(client)["items"][0]
    profile = detail(client, provider)

    for shape in (item, profile):
        assert shape["sponsored"] is True
        assert shape["featured"] is True
        assert shape["sponsor_hook"] == "Fixed in an hour."


def test_featured_until_today_still_counts(client, db):
    provider = make_provider(
        db, make_category(db, "plumber"), featured_until=today(), sponsor_hook="Hook"
    )

    assert detail(client, provider)["sponsored"] is True


def test_hook_is_hidden_when_not_sponsored(client, db):
    category = make_category(db, "plumber")
    never = make_provider(db, category, "never", sponsor_hook="Hook")
    expired = make_provider(
        db, category, "expired", featured_until=yesterday(), sponsor_hook="Hook"
    )

    for provider in (never, expired):
        profile = detail(client, provider)
        assert profile["sponsored"] is False
        assert profile["sponsor_hook"] is None
    for item in search(client)["items"]:
        assert item["sponsored"] is False
        assert item["sponsor_hook"] is None


@pytest.mark.parametrize("status", ["unverified", "pending"])
def test_non_verified_providers_are_never_sponsored(client, db, status):
    provider = make_provider(
        db,
        make_category(db, "plumber"),
        status=status,
        featured_until=next_month(),
        sponsor_hook="Hook",
    )

    item = search(client, include_unverified=True)["items"][0]
    profile = detail(client, provider)

    for shape in (item, profile):
        assert shape["sponsored"] is False
        assert shape["sponsor_hook"] is None


def test_sponsored_without_a_hook_has_null_hook(client, db):
    provider = make_provider(db, make_category(db, "plumber"), featured_until=next_month())

    profile = detail(client, provider)

    assert profile["sponsored"] is True
    assert profile["sponsor_hook"] is None


def test_ranking_is_unchanged_sponsored_first_among_verified(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "plain", distance_m=10, avg_rating=5, review_count=50)
    make_provider(db, category, "sponsored", distance_m=400, featured_until=next_month())

    assert [item["name"] for item in search(client)["items"]] == ["sponsored", "plain"]


# ---------- the owner sets the hook ----------


def test_owner_sets_and_clears_the_hook(client, db):
    user_id = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=user_id)
    headers = auth_headers(user_id)

    set_hook = client.patch(ME_URL, json={"sponsor_hook": "  Best in town.  "}, headers=headers)
    assert set_hook.status_code == 200, set_hook.text
    # The owner sees the stored hook even though the profile is not sponsored.
    assert set_hook.json()["sponsor_hook"] == "Best in town."
    assert set_hook.json()["sponsored"] is False

    other_edit = client.patch(ME_URL, json={"name": "New name"}, headers=headers)
    assert other_edit.json()["sponsor_hook"] == "Best in town."

    cleared = client.patch(ME_URL, json={"sponsor_hook": None}, headers=headers)
    assert cleared.json()["sponsor_hook"] is None


def test_empty_hook_clears_it_and_long_hook_is_rejected(client, db):
    user_id = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=user_id, sponsor_hook="Old")
    headers = auth_headers(user_id)

    too_long = client.patch(ME_URL, json={"sponsor_hook": "x" * 81}, headers=headers)
    assert too_long.status_code == 422

    longest = client.patch(ME_URL, json={"sponsor_hook": "x" * 80}, headers=headers)
    assert longest.status_code == 200

    blank = client.patch(ME_URL, json={"sponsor_hook": "   "}, headers=headers)
    assert blank.json()["sponsor_hook"] is None


def test_hook_can_be_sent_on_create(client, db):
    category = make_category(db, "plumber")
    body = valid_provider_body(category.id, sponsor_hook="Open late every day.")

    response = client.post(ME_URL, json=body, headers=auth_headers(uuid.uuid4()))

    assert response.status_code == 201, response.text
    assert response.json()["sponsor_hook"] == "Open late every day."


def test_owner_cannot_make_themselves_sponsored(client, db):
    user_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=user_id)

    client.patch(
        ME_URL,
        json={"sponsor_hook": "Hook", "featured_until": str(next_month())},
        headers=auth_headers(user_id),
    )

    profile = detail(client, provider)
    assert profile["sponsored"] is False
    assert profile["sponsor_hook"] is None


def test_admin_sponsors_a_provider_and_the_hook_appears(client, db):
    provider = make_provider(db, make_category(db, "plumber"), sponsor_hook="Hook")

    response = client.patch(
        f"/api/v1/admin/providers/{provider.id}",
        json={"featured_until": str(next_month())},
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["sponsor_hook"] == "Hook"
    profile = detail(client, provider)
    assert profile["sponsored"] is True
    assert profile["sponsor_hook"] == "Hook"
