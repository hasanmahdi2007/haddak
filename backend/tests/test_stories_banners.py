"""Stories and banners: posting rules, limits, expiry, public lists, admin delete."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Banner, Story
from tests.conftest import (
    ADMIN_HEADERS,
    CENTER_LAT,
    CENTER_LNG,
    auth_headers,
    make_category,
    make_provider,
    search,
)

STORIES_URL = "/api/v1/me/provider/stories"
BANNER_URL = "/api/v1/me/provider/banner"
NEARBY_URL = "/api/v1/stories/nearby"


def now() -> datetime:
    return datetime.now(UTC)


def make_owner(db, status: str = "verified", **provider_fields):
    """A provider with a known owner. Returns (provider, the owner's headers)."""
    user_id = uuid.uuid4()
    category = make_category(db, "cat-" + uuid.uuid4().hex[:6])
    provider = make_provider(db, category, owner_user_id=user_id, status=status, **provider_fields)
    return provider, auth_headers(user_id)


def make_story(db, provider, text="Hello", *, age: timedelta = timedelta(0)) -> Story:
    """Insert a story created `age` ago (25 hours ago = already expired)."""
    created_at = now() - age
    story = Story(
        provider_id=provider.id,
        text=text,
        created_at=created_at,
        expires_at=created_at + timedelta(hours=24),
    )
    db.add(story)
    db.commit()
    return story


def make_banner(db, provider, title="Offer", *, expired: bool = False) -> Banner:
    starts_at = now() - timedelta(days=8 if expired else 1)
    banner = Banner(
        provider_id=provider.id,
        title=title,
        starts_at=starts_at,
        expires_at=starts_at + timedelta(days=7),
    )
    db.add(banner)
    db.commit()
    return banner


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def nearby(client, radius_m: int = 500) -> list[dict]:
    params = {"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_m": radius_m}
    response = client.get(NEARBY_URL, params=params)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def detail(client, provider) -> dict:
    response = client.get(f"/api/v1/providers/{provider.id}")
    assert response.status_code == 200, response.text
    return response.json()


# ---------- who may post ----------


@pytest.mark.parametrize(
    "method, path",
    [
        ("POST", STORIES_URL),
        ("DELETE", f"{STORIES_URL}/{uuid.uuid4()}"),
        ("PUT", BANNER_URL),
        ("DELETE", BANNER_URL),
    ],
)
def test_post_routes_need_a_token(client, method, path):
    response = client.request(method, path, json={"text": "Hi", "title": "Hi"})
    assert response.status_code == 401


def test_posting_without_a_profile_is_404(client):
    headers = auth_headers(uuid.uuid4())

    assert client.post(STORIES_URL, json={"text": "Hi"}, headers=headers).status_code == 404
    assert client.put(BANNER_URL, json={"title": "Hi"}, headers=headers).status_code == 404


@pytest.mark.parametrize("status", ["unverified", "pending", "rejected"])
def test_only_verified_providers_can_post(client, db, status):
    _, headers = make_owner(db, status=status)

    story = client.post(STORIES_URL, json={"text": "Hi"}, headers=headers)
    banner = client.put(BANNER_URL, json={"title": "Hi"}, headers=headers)

    assert story.status_code == 403
    assert banner.status_code == 403
    assert count(db, Story) == 0
    assert count(db, Banner) == 0


# ---------- stories ----------


def test_post_story_returns_it_with_a_24_hour_life(client, db):
    provider, headers = make_owner(db)

    response = client.post(
        STORIES_URL,
        json={"text": "  Fresh knafeh today  ", "image_url": "https://example.com/k.jpg"},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    story = response.json()
    assert set(story) == {"id", "provider_id", "text", "image_url", "created_at", "expires_at"}
    assert story["provider_id"] == str(provider.id)
    assert story["text"] == "Fresh knafeh today"
    assert story["image_url"] == "https://example.com/k.jpg"
    created = datetime.fromisoformat(story["created_at"])
    expires = datetime.fromisoformat(story["expires_at"])
    assert expires - created == timedelta(hours=24)


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": ""},
        {"text": "   "},
        {"text": "x" * 281},
        {"text": "ok", "image_url": "http://example.com/not-https.jpg"},
        {"text": "ok", "image_url": "javascript:alert(1)"},
    ],
)
def test_story_validation(client, db, body):
    _, headers = make_owner(db)

    response = client.post(STORIES_URL, json=body, headers=headers)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_story_text_may_be_280_characters_and_image_may_be_blank(client, db):
    _, headers = make_owner(db)

    response = client.post(STORIES_URL, json={"text": "x" * 280, "image_url": ""}, headers=headers)

    assert response.status_code == 201
    assert response.json()["image_url"] is None


def test_at_most_five_active_stories(client, db):
    provider, headers = make_owner(db)
    for number in range(5):
        response = client.post(STORIES_URL, json={"text": f"Story {number}"}, headers=headers)
        assert response.status_code == 201

    sixth = client.post(STORIES_URL, json={"text": "One too many"}, headers=headers)

    assert sixth.status_code == 409
    assert count(db, Story) == 5


def test_expired_stories_do_not_count_towards_the_limit(client, db):
    provider, headers = make_owner(db)
    for _ in range(5):
        make_story(db, provider, age=timedelta(hours=25))

    response = client.post(STORIES_URL, json={"text": "New"}, headers=headers)

    assert response.status_code == 201


def test_deleting_a_story_makes_room_for_another(client, db):
    provider, headers = make_owner(db)
    stories = [make_story(db, provider) for _ in range(5)]

    deleted = client.delete(f"{STORIES_URL}/{stories[0].id}", headers=headers)
    again = client.post(STORIES_URL, json={"text": "New"}, headers=headers)

    assert deleted.status_code == 204
    assert again.status_code == 201


def test_cannot_delete_someone_elses_story(client, db):
    other_provider, _ = make_owner(db)
    story = make_story(db, other_provider)
    _, my_headers = make_owner(db)

    response = client.delete(f"{STORIES_URL}/{story.id}", headers=my_headers)

    assert response.status_code == 404
    assert count(db, Story) == 1


def test_delete_unknown_story_is_404(client, db):
    _, headers = make_owner(db)

    assert client.delete(f"{STORIES_URL}/{uuid.uuid4()}", headers=headers).status_code == 404


def test_owner_can_delete_a_story_after_losing_the_badge(client, db):
    provider, headers = make_owner(db)
    story = make_story(db, provider)
    provider.status = "unverified"
    db.commit()

    assert client.delete(f"{STORIES_URL}/{story.id}", headers=headers).status_code == 204


# ---------- public story list ----------


def test_provider_stories_lists_active_ones_newest_first(client, db):
    provider, _ = make_owner(db)
    make_story(db, provider, "old", age=timedelta(hours=5))
    make_story(db, provider, "new", age=timedelta(minutes=5))
    make_story(db, provider, "expired", age=timedelta(hours=25))
    other, _ = make_owner(db)
    make_story(db, other, "someone else")

    response = client.get(f"/api/v1/providers/{provider.id}/stories")

    assert response.status_code == 200
    assert [story["text"] for story in response.json()["items"]] == ["new", "old"]


def test_provider_stories_404_for_unknown_or_rejected(client, db):
    rejected, _ = make_owner(db, status="rejected")

    assert client.get(f"/api/v1/providers/{uuid.uuid4()}/stories").status_code == 404
    assert client.get(f"/api/v1/providers/{rejected.id}/stories").status_code == 404


def test_stories_are_hidden_while_the_provider_is_not_verified(client, db):
    provider, _ = make_owner(db)
    make_story(db, provider)
    make_banner(db, provider)
    provider.status = "unverified"
    db.commit()

    stories = client.get(f"/api/v1/providers/{provider.id}/stories").json()["items"]
    profile = detail(client, provider)

    assert stories == []
    assert profile["has_active_story"] is False
    assert profile["active_banner"] is None
    assert profile["banner_title"] is None
    assert nearby(client) == []


# ---------- banners ----------


def test_put_banner_creates_it_with_seven_days_by_default(client, db):
    provider, headers = make_owner(db)

    response = client.put(
        BANNER_URL,
        json={"title": "Back to school", "text": "All repairs", "discount_percent": 20},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    banner = response.json()
    assert set(banner) == {"title", "text", "discount_percent", "starts_at", "expires_at"}
    assert banner["title"] == "Back to school"
    assert banner["text"] == "All repairs"
    assert banner["discount_percent"] == 20
    starts = datetime.fromisoformat(banner["starts_at"])
    expires = datetime.fromisoformat(banner["expires_at"])
    assert expires - starts == timedelta(days=7)
    assert detail(client, provider)["active_banner"] == banner


def test_banner_days_can_be_chosen_and_optional_fields_left_out(client, db):
    _, headers = make_owner(db)

    response = client.put(BANNER_URL, json={"title": "Today only", "days": 1}, headers=headers)

    banner = response.json()
    assert response.status_code == 200
    assert banner["text"] is None
    assert banner["discount_percent"] is None
    starts = datetime.fromisoformat(banner["starts_at"])
    assert datetime.fromisoformat(banner["expires_at"]) - starts == timedelta(days=1)


def test_a_new_banner_replaces_the_old_one(client, db):
    provider, headers = make_owner(db)
    client.put(BANNER_URL, json={"title": "First", "discount_percent": 10}, headers=headers)

    client.put(BANNER_URL, json={"title": "Second"}, headers=headers)

    assert count(db, Banner) == 1
    active = detail(client, provider)["active_banner"]
    assert active["title"] == "Second"
    assert active["discount_percent"] is None


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"title": "x" * 61},
        {"title": "ok", "text": "x" * 201},
        {"title": "ok", "discount_percent": 0},
        {"title": "ok", "discount_percent": 91},
        {"title": "ok", "days": 0},
        {"title": "ok", "days": 8},
    ],
)
def test_banner_validation(client, db, body):
    _, headers = make_owner(db)

    assert client.put(BANNER_URL, json=body, headers=headers).status_code == 422


def test_delete_banner_is_idempotent(client, db):
    provider, headers = make_owner(db)
    make_banner(db, provider)

    first = client.delete(BANNER_URL, headers=headers)
    second = client.delete(BANNER_URL, headers=headers)

    assert first.status_code == 204
    assert second.status_code == 204
    assert count(db, Banner) == 0
    assert detail(client, provider)["active_banner"] is None


def test_expired_banner_is_not_shown(client, db):
    provider, _ = make_owner(db)
    make_banner(db, provider, expired=True)

    profile = detail(client, provider)

    assert profile["active_banner"] is None
    assert profile["banner_title"] is None
    assert search(client)["items"][0]["banner_title"] is None


# ---------- flags on detail and search ----------


def test_detail_and_search_show_story_and_banner_flags(client, db):
    with_posts, _ = make_owner(db, name="with posts")
    make_story(db, with_posts)
    make_banner(db, with_posts, "Half price")
    only_expired, _ = make_owner(db, name="only expired")
    make_story(db, only_expired, age=timedelta(hours=25))
    make_owner(db, name="nothing")

    items = {item["name"]: item for item in search(client)["items"]}

    assert items["with posts"]["has_active_story"] is True
    assert items["with posts"]["banner_title"] == "Half price"
    assert items["only expired"]["has_active_story"] is False
    assert items["nothing"]["has_active_story"] is False
    assert items["nothing"]["banner_title"] is None

    profile = detail(client, with_posts)
    assert profile["has_active_story"] is True
    assert profile["banner_title"] == "Half price"
    assert profile["active_banner"]["title"] == "Half price"


def test_own_profile_shows_my_banner(client, db):
    _, headers = make_owner(db)
    client.put(BANNER_URL, json={"title": "Mine"}, headers=headers)

    mine = client.get("/api/v1/me/provider", headers=headers).json()

    assert mine["active_banner"]["title"] == "Mine"
    assert mine["has_active_story"] is False


# ---------- stories nearby ----------


def test_nearby_groups_stories_by_provider_newest_first(client, db):
    older, _ = make_owner(db, name="older", distance_m=100)
    make_story(db, older, "older 1", age=timedelta(hours=3))
    make_story(db, older, "older 2", age=timedelta(hours=2))
    newer, _ = make_owner(db, name="newer", distance_m=200)
    make_story(db, newer, "newer 1", age=timedelta(minutes=1))
    make_story(db, newer, "expired", age=timedelta(hours=30))
    make_owner(db, name="no stories", distance_m=50)

    groups = nearby(client)

    assert [group["provider"]["name"] for group in groups] == ["newer", "older"]
    assert [story["text"] for story in groups[0]["stories"]] == ["newer 1"]
    assert [story["text"] for story in groups[1]["stories"]] == ["older 2", "older 1"]
    assert groups[0]["provider"]["distance_m"] == 200
    assert groups[0]["provider"]["has_active_story"] is True


def test_nearby_respects_the_radius_and_leaves_out_non_verified(client, db):
    inside, _ = make_owner(db, name="inside", distance_m=400)
    make_story(db, inside)
    outside, _ = make_owner(db, name="outside", distance_m=600)
    make_story(db, outside)
    for status in ("unverified", "pending", "rejected"):
        hidden, _ = make_owner(db, status=status, name=status, distance_m=100)
        make_story(db, hidden)

    assert [group["provider"]["name"] for group in nearby(client, 500)] == ["inside"]
    assert len(nearby(client, 1000)) == 2


def test_nearby_is_capped_at_30_providers(client, db):
    category = make_category(db, "plumber")
    for number in range(32):
        provider = make_provider(db, category, f"p{number}")
        make_story(db, provider, age=timedelta(minutes=number))

    groups = nearby(client)

    assert len(groups) == 30
    assert groups[0]["provider"]["name"] == "p0"  # the newest story


def test_nearby_validates_its_query(client):
    assert client.get(NEARBY_URL).status_code == 422
    bad_radius = {"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_m": 50}
    assert client.get(NEARBY_URL, params=bad_radius).status_code == 422


# ---------- admin ----------


def test_admin_can_delete_any_story(client, db):
    provider, _ = make_owner(db)
    story = make_story(db, provider)
    url = f"/api/v1/admin/stories/{story.id}"

    assert client.delete(url).status_code == 401
    assert client.delete(url, headers=ADMIN_HEADERS).status_code == 204
    assert client.delete(url, headers=ADMIN_HEADERS).status_code == 404
    assert count(db, Story) == 0


def test_admin_can_delete_any_banner(client, db):
    provider, _ = make_owner(db)
    make_banner(db, provider)
    url = f"/api/v1/admin/providers/{provider.id}/banner"

    assert client.delete(url).status_code == 401
    assert client.delete(url, headers=ADMIN_HEADERS).status_code == 204
    assert client.delete(url, headers=ADMIN_HEADERS).status_code == 404
    assert count(db, Banner) == 0


# ---------- rate limit ----------


def test_post_routes_share_the_write_limit(client, db):
    _, headers = make_owner(db)
    # 20 writes per minute per IP, whichever of the write routes they hit.
    for _ in range(10):
        assert client.put(BANNER_URL, json={"title": "Hi"}, headers=headers).status_code == 200
        assert client.delete(BANNER_URL, headers=headers).status_code == 204

    for method, url in [
        ("POST", STORIES_URL),
        ("DELETE", f"{STORIES_URL}/{uuid.uuid4()}"),
        ("PUT", BANNER_URL),
        ("DELETE", BANNER_URL),
    ]:
        response = client.request(method, url, json={"text": "Hi", "title": "Hi"}, headers=headers)
        assert response.status_code == 429
        assert "Retry-After" in response.headers


def test_admin_lists_active_stories_and_banners_with_provider_name(client, db):
    provider, _ = make_owner(db, name="Salon Noor")
    make_story(db, provider, "fresh")
    make_story(db, provider, "old", age=timedelta(hours=25))  # expired: not listed
    make_banner(db, provider, "Half price")
    other, _ = make_owner(db, name="Gone Garage")
    make_banner(db, other, "Old offer", expired=True)  # expired: not listed

    stories = client.get("/api/v1/admin/stories", headers=ADMIN_HEADERS).json()["items"]
    banners = client.get("/api/v1/admin/banners", headers=ADMIN_HEADERS).json()["items"]

    assert [(s["text"], s["provider_name"]) for s in stories] == [("fresh", "Salon Noor")]
    assert stories[0]["provider_id"] == str(provider.id)
    assert [(b["title"], b["provider_name"]) for b in banners] == [("Half price", "Salon Noor")]
    assert banners[0]["provider_id"] == str(provider.id)


@pytest.mark.parametrize("path", ["/api/v1/admin/stories", "/api/v1/admin/banners"])
def test_admin_post_lists_need_the_admin_key(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"X-Admin-Key": "wrong-key"}).status_code == 401
