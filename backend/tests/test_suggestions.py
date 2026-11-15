"""Suggest a provider: public create, rate limit, admin list and delete."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.models import ProviderSuggestion
from app.rate_limit import RateLimiter
from tests.conftest import ADMIN_HEADERS, make_category

URL = "/api/v1/suggestions"
ADMIN_URL = "/api/v1/admin/suggestions"


def count_suggestions(db) -> int:
    return db.scalar(select(func.count()).select_from(ProviderSuggestion))


def make_suggestion(db, name: str, created_at: datetime | None = None) -> ProviderSuggestion:
    suggestion = ProviderSuggestion(name=name)
    if created_at is not None:
        suggestion.created_at = created_at
    db.add(suggestion)
    db.commit()
    return suggestion


# ---------- create ----------


def test_create_with_all_fields_needs_no_login(client, db):
    category = make_category(db, "tailor")
    body = {
        "name": "  Abu Ali Tailor  ",
        "phone": "+96170123456",
        "category_id": category.id,
        "area_name": "Mazraa",
        "note": "Best tailor in the area.",
    }

    response = client.post(URL, json=body)

    assert response.status_code == 201
    assert set(response.json()) == {"id"}
    saved = db.get(ProviderSuggestion, uuid.UUID(response.json()["id"]))
    assert saved.name == "Abu Ali Tailor"  # spaces around the text are removed
    assert saved.phone == "+96170123456"
    assert saved.category_id == category.id
    assert saved.area_name == "Mazraa"
    assert saved.note == "Best tailor in the area."
    assert saved.created_at is not None


def test_create_with_only_a_name(client, db):
    response = client.post(URL, json={"name": "Abu Ali Tailor"})

    assert response.status_code == 201
    saved = db.get(ProviderSuggestion, uuid.UUID(response.json()["id"]))
    assert (saved.phone, saved.category_id, saved.area_name, saved.note) == (None, None, None, None)


def test_table_stores_nothing_about_the_sender(db):
    columns = set(
        db.scalars(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'provider_suggestions'"
            )
        )
    )
    assert columns == {"id", "name", "phone", "category_id", "area_name", "note", "created_at"}


@pytest.mark.parametrize(
    "bad_body",
    [
        {},  # name is required
        {"name": ""},
        {"name": "   "},  # only spaces
        {"name": "x" * 101},
        {"name": "Ali", "phone": "70123456"},  # not international format
        {"name": "Ali", "phone": "+961 70 123 456"},
        {"name": "Ali", "area_name": "x" * 101},
        {"name": "Ali", "note": "x" * 501},
        {"name": "Ali", "category_id": "tailor"},
    ],
)
def test_create_validation(client, db, bad_body):
    response = client.post(URL, json=bad_body)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert count_suggestions(db) == 0


def test_longest_allowed_texts_are_accepted(client):
    body = {"name": "x" * 100, "area_name": "y" * 100, "note": "z" * 500}
    assert client.post(URL, json=body).status_code == 201


def test_unknown_category_is_400(client, db):
    response = client.post(URL, json={"name": "Ali", "category_id": 999999})

    assert response.status_code == 400
    assert count_suggestions(db) == 0


# ---------- rate limit ----------


def test_suggestions_are_limited_to_5_per_hour(client, db, clock):
    for _ in range(5):
        assert client.post(URL, json={"name": "Ali"}).status_code == 201
    blocked = client.post(URL, json={"name": "Ali"})

    assert blocked.status_code == 429
    assert isinstance(blocked.json()["detail"], str)
    assert blocked.headers["Retry-After"] == "3600"
    assert count_suggestions(db) == 5

    # Still blocked after a minute (this limit is per hour, not per minute)...
    clock.advance(61)
    assert client.post(URL, json={"name": "Ali"}).status_code == 429
    # ...and allowed again once the hour has passed.
    clock.advance(3600)
    assert client.post(URL, json={"name": "Ali"}).status_code == 201


def test_suggestion_limit_is_separate_from_other_limits(client, db):
    for _ in range(5):
        client.post(URL, json={"name": "Ali"})

    # Reading is never limited, and the admin can still work.
    assert client.get("/api/v1/categories").status_code == 200
    assert client.get(ADMIN_URL, headers=ADMIN_HEADERS).status_code == 200


def test_rate_limiter_remembers_hourly_keys_through_a_cleanup(clock, monkeypatch):
    # The cleanup drops keys idle for 10 minutes; an hourly key must survive it.
    monkeypatch.setattr("app.rate_limit.CLEANUP_THRESHOLD", 2)
    limiter = RateLimiter(clock=clock)
    for _ in range(5):
        limiter.seconds_to_wait("hourly", limit=5, window_seconds=3600)

    clock.advance(30 * 60)
    limiter.seconds_to_wait("a", limit=3, window_seconds=60)
    limiter.seconds_to_wait("b", limit=3, window_seconds=60)  # triggers a cleanup

    assert limiter.seconds_to_wait("hourly", limit=5, window_seconds=3600) == 30 * 60


# ---------- admin ----------


def test_admin_routes_need_the_right_key(client, db):
    suggestion = make_suggestion(db, "Ali")
    delete_url = f"{ADMIN_URL}/{suggestion.id}"
    wrong = {"X-Admin-Key": "wrong-key"}

    assert client.get(ADMIN_URL).status_code == 401
    assert client.get(ADMIN_URL, headers=wrong).status_code == 401
    assert client.delete(delete_url).status_code == 401
    assert client.delete(delete_url, headers=wrong).status_code == 401

    assert count_suggestions(db) == 1  # nothing was deleted


def test_admin_list_is_newest_first_with_all_fields(client, db):
    category = make_category(db, "tailor")
    now = datetime.now(UTC)
    make_suggestion(db, "oldest", created_at=now - timedelta(days=2))
    make_suggestion(db, "middle", created_at=now - timedelta(days=1))
    created = client.post(
        URL,
        json={
            "name": "newest",
            "phone": "+96170123456",
            "category_id": category.id,
            "area_name": "Mazraa",
            "note": "Very good.",
        },
    ).json()

    body = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()

    assert body["total"] == 3
    assert [item["name"] for item in body["items"]] == ["newest", "middle", "oldest"]
    newest = body["items"][0]
    assert set(newest) == {"id", "name", "phone", "category", "area_name", "note", "created_at"}
    assert newest["id"] == created["id"]
    assert newest["phone"] == "+96170123456"
    assert newest["category"]["slug"] == "tailor"
    assert newest["area_name"] == "Mazraa"
    assert newest["note"] == "Very good."
    assert newest["created_at"].endswith("Z")
    # A suggestion with only a name has nulls, including the category.
    assert body["items"][2]["category"] is None
    assert body["items"][2]["phone"] is None


def test_admin_list_paging(client, db):
    now = datetime.now(UTC)
    for number in range(5):
        make_suggestion(db, f"s{number}", created_at=now - timedelta(minutes=number))

    page = client.get(ADMIN_URL, params={"limit": 2, "offset": 1}, headers=ADMIN_HEADERS).json()
    empty = client.get(ADMIN_URL, params={"offset": 10}, headers=ADMIN_HEADERS).json()

    assert [item["name"] for item in page["items"]] == ["s1", "s2"]
    assert page["total"] == 5
    assert empty == {"items": [], "total": 5}
    assert client.get(ADMIN_URL, params={"limit": 101}, headers=ADMIN_HEADERS).status_code == 422
    assert client.get(ADMIN_URL, params={"limit": 0}, headers=ADMIN_HEADERS).status_code == 422


def test_admin_list_when_empty(client):
    response = client.get(ADMIN_URL, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


def test_admin_delete(client, db):
    keep = make_suggestion(db, "keep")
    remove = make_suggestion(db, "remove")

    response = client.delete(f"{ADMIN_URL}/{remove.id}", headers=ADMIN_HEADERS)

    assert response.status_code == 204
    assert response.content == b""
    remaining = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()
    assert [item["id"] for item in remaining["items"]] == [str(keep.id)]

    # Deleting it again, or a made-up id, is 404; a bad id is 422.
    assert client.delete(f"{ADMIN_URL}/{remove.id}", headers=ADMIN_HEADERS).status_code == 404
    assert client.delete(f"{ADMIN_URL}/{uuid.uuid4()}", headers=ADMIN_HEADERS).status_code == 404
    assert client.delete(f"{ADMIN_URL}/not-a-uuid", headers=ADMIN_HEADERS).status_code == 422


def test_admin_page_has_the_suggestions_section(client):
    page = client.get("/admin").text

    assert "Suggestions" in page
    assert "/suggestions" in page
    assert "innerHTML" not in page
