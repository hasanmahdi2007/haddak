"""Follows: follow / unfollow, my list, my feed, counts on the profile."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Follow, Story
from tests.conftest import auth_headers, make_category, make_provider

FOLLOWING_URL = "/api/v1/me/following"
FEED_URL = "/api/v1/me/feed"


def follow_url(provider_id) -> str:
    return f"/api/v1/providers/{provider_id}/follow"


def count_follows(db) -> int:
    return db.scalar(select(func.count()).select_from(Follow))


def make_follow(db, user_id, provider, *, days_ago: int = 0) -> None:
    created_at = datetime.now(UTC) - timedelta(days=days_ago)
    db.add(Follow(user_id=user_id, provider_id=provider.id, created_at=created_at))
    db.commit()


def make_story(db, provider, text="Hello", *, age: timedelta = timedelta(0)) -> None:
    created_at = datetime.now(UTC) - age
    db.add(
        Story(
            provider_id=provider.id,
            text=text,
            created_at=created_at,
            expires_at=created_at + timedelta(hours=24),
        )
    )
    db.commit()


# ---------- follow / unfollow ----------


@pytest.mark.parametrize(
    "method, path",
    [
        ("PUT", follow_url(uuid.uuid4())),
        ("DELETE", follow_url(uuid.uuid4())),
        ("GET", FOLLOWING_URL),
        ("GET", FEED_URL),
    ],
)
def test_follow_routes_need_a_token(client, method, path):
    assert client.request(method, path).status_code == 401


def test_follow_is_idempotent(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    headers = auth_headers(uuid.uuid4())

    first = client.put(follow_url(provider.id), headers=headers)
    second = client.put(follow_url(provider.id), headers=headers)

    assert first.status_code == 204
    assert second.status_code == 204
    assert count_follows(db) == 1


def test_unfollow_is_idempotent(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    user_id = uuid.uuid4()
    make_follow(db, user_id, provider)
    headers = auth_headers(user_id)

    first = client.delete(follow_url(provider.id), headers=headers)
    second = client.delete(follow_url(provider.id), headers=headers)

    assert first.status_code == 204
    assert second.status_code == 204
    assert count_follows(db) == 0


def test_unfollow_only_removes_my_own_follow(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    someone_else = uuid.uuid4()
    make_follow(db, someone_else, provider)

    client.delete(follow_url(provider.id), headers=auth_headers(uuid.uuid4()))

    assert count_follows(db) == 1


@pytest.mark.parametrize("status", ["unverified", "pending"])
def test_non_verified_public_providers_can_be_followed(client, db, status):
    provider = make_provider(db, make_category(db, "plumber"), status=status)

    response = client.put(follow_url(provider.id), headers=auth_headers(uuid.uuid4()))

    assert response.status_code == 204
    assert count_follows(db) == 1


def test_rejected_or_unknown_providers_cannot_be_followed(client, db):
    rejected = make_provider(db, make_category(db, "plumber"), status="rejected")
    headers = auth_headers(uuid.uuid4())

    assert client.put(follow_url(rejected.id), headers=headers).status_code == 404
    assert client.put(follow_url(uuid.uuid4()), headers=headers).status_code == 404
    assert client.delete(follow_url(rejected.id), headers=headers).status_code == 404
    assert count_follows(db) == 0


def test_follow_routes_share_the_write_limit(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    headers = auth_headers(uuid.uuid4())
    for _ in range(10):
        assert client.put(follow_url(provider.id), headers=headers).status_code == 204
        assert client.delete(follow_url(provider.id), headers=headers).status_code == 204

    assert client.put(follow_url(provider.id), headers=headers).status_code == 429
    assert client.delete(follow_url(provider.id), headers=headers).status_code == 429


# ---------- follower_count and is_following on the profile ----------


def test_detail_shows_follower_count_and_is_following(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    me = uuid.uuid4()
    make_follow(db, me, provider)
    make_follow(db, uuid.uuid4(), provider)
    url = f"/api/v1/providers/{provider.id}"

    anonymous = client.get(url).json()
    as_me = client.get(url, headers=auth_headers(me)).json()
    as_stranger = client.get(url, headers=auth_headers(uuid.uuid4())).json()
    bad_token = client.get(url, headers={"Authorization": "Bearer nonsense"}).json()

    assert anonymous["follower_count"] == 2
    assert anonymous["is_following"] is False
    assert as_me["is_following"] is True
    assert as_stranger["is_following"] is False
    assert bad_token["is_following"] is False


def test_by_slug_also_shows_is_following(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    me = uuid.uuid4()
    make_follow(db, me, provider)

    response = client.get(f"/api/v1/providers/by-slug/{provider.slug}", headers=auth_headers(me))

    assert response.json()["is_following"] is True
    assert response.json()["follower_count"] == 1


def test_follow_then_unfollow_changes_the_profile(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    headers = auth_headers(uuid.uuid4())
    url = f"/api/v1/providers/{provider.id}"

    client.put(follow_url(provider.id), headers=headers)
    assert client.get(url, headers=headers).json()["is_following"] is True

    client.delete(follow_url(provider.id), headers=headers)
    after = client.get(url, headers=headers).json()
    assert after["is_following"] is False
    assert after["follower_count"] == 0


# ---------- GET /me/following ----------


def test_following_lists_my_providers_most_recent_first(client, db):
    category = make_category(db, "plumber")
    me = uuid.uuid4()
    make_follow(db, me, make_provider(db, category, "followed first"), days_ago=3)
    make_follow(db, me, make_provider(db, category, "followed last", status="unverified"))
    make_follow(db, me, make_provider(db, category, "rejected", status="rejected"), days_ago=1)
    make_follow(db, uuid.uuid4(), make_provider(db, category, "not mine"))

    response = client.get(FOLLOWING_URL, headers=auth_headers(me))

    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body["items"]] == ["followed last", "followed first"]
    assert body["total"] == 2
    assert body["items"][0]["distance_m"] is None
    assert body["items"][0]["verified"] is False
    assert "status" not in body["items"][0]


def test_following_is_paged(client, db):
    category = make_category(db, "plumber")
    me = uuid.uuid4()
    for number in range(3):
        make_follow(db, me, make_provider(db, category, f"p{number}"), days_ago=number)

    body = client.get(
        FOLLOWING_URL, params={"limit": 2, "offset": 2}, headers=auth_headers(me)
    ).json()

    assert [item["name"] for item in body["items"]] == ["p2"]
    assert body["total"] == 3


def test_following_is_empty_for_a_new_user(client):
    body = client.get(FOLLOWING_URL, headers=auth_headers(uuid.uuid4())).json()

    assert body == {"items": [], "total": 0}


# ---------- GET /me/feed ----------


def test_feed_shows_active_stories_of_followed_providers(client, db):
    category = make_category(db, "plumber")
    me = uuid.uuid4()
    quiet = make_provider(db, category, "quiet")
    make_follow(db, me, quiet)
    older = make_provider(db, category, "older")
    make_follow(db, me, older)
    make_story(db, older, "older 1", age=timedelta(hours=4))
    make_story(db, older, "expired", age=timedelta(hours=25))
    newer = make_provider(db, category, "newer")
    make_follow(db, me, newer)
    make_story(db, newer, "newer 1", age=timedelta(hours=2))
    make_story(db, newer, "newer 2", age=timedelta(hours=1))
    not_followed = make_provider(db, category, "not followed")
    make_story(db, not_followed)

    response = client.get(FEED_URL, headers=auth_headers(me))

    assert response.status_code == 200
    groups = response.json()["items"]
    assert [group["provider"]["name"] for group in groups] == ["newer", "older"]
    assert [story["text"] for story in groups[0]["stories"]] == ["newer 2", "newer 1"]
    assert [story["text"] for story in groups[1]["stories"]] == ["older 1"]
    assert groups[0]["provider"]["distance_m"] is None


def test_feed_leaves_out_providers_that_are_not_verified(client, db):
    category = make_category(db, "plumber")
    me = uuid.uuid4()
    for status in ("unverified", "rejected"):
        provider = make_provider(db, category, status, status=status)
        make_follow(db, me, provider)
        make_story(db, provider)

    assert client.get(FEED_URL, headers=auth_headers(me)).json() == {"items": []}
