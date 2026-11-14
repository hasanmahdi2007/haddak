"""Production hardening: name search, health, rate limits, admin page,
request logging and the production startup check."""

import logging
import uuid

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.config import Settings, check_startup_settings, production_problems, settings
from app.db import get_db
from app.main import app
from app.models import ContactEvent
from app.rate_limit import RateLimiter
from tests.conftest import (
    CENTER_LAT,
    CENTER_LNG,
    TEST_ADMIN_KEY,
    TEST_JWT_SECRET,
    FakeClock,
    auth_headers,
    make_category,
    make_provider,
    search,
    valid_provider_body,
)

SEARCH_URL = "/api/v1/providers/search"
REVIEW_BODY = {"rating": 5, "comment": "", "author_name": "Rana"}


def names(result: dict) -> list[str]:
    return sorted(item["name"] for item in result["items"])


def count_events(db, provider) -> int:
    return db.scalar(
        select(func.count())
        .select_from(ContactEvent)
        .where(ContactEvent.provider_id == provider.id)
    )


# ---------- B9: q (name search) ----------


def test_q_matches_part_of_the_name_ignoring_case(client, db):
    category = make_category(db, "laptop-repair")
    make_provider(db, category, "Ali Tech")
    make_provider(db, category, "TECHNO Fix")
    make_provider(db, category, "Abu Hassan Plumbing")

    result = search(client, q="tech")

    assert names(result) == ["Ali Tech", "TECHNO Fix"]
    assert result["total"] == 2
    assert names(search(client, q="ALI T")) == ["Ali Tech"]
    assert names(search(client, q="zzz")) == []


def test_q_works_with_arabic_names(client, db):
    category = make_category(db, "arabic-sweets")
    make_provider(db, category, "حلويات البابا")
    make_provider(db, category, "Sweet Corner")

    assert names(search(client, q="حلويات")) == ["حلويات البابا"]


def test_q_combines_with_category_and_radius(client, db):
    music = make_category(db, "music-lessons")
    piano = make_category(db, "piano-lessons", parent=music)
    repair = make_category(db, "laptop-repair")
    make_provider(db, piano, "Nour Piano")
    make_provider(db, repair, "Nour Laptops")
    make_provider(db, piano, "Nour Piano Far Away", distance_m=2000)
    make_provider(db, piano, "Nour Piano Pending", status="pending")

    result = search(client, q="nour", category_id=music.id, radius_m=500)

    assert names(result) == ["Nour Piano"]


def test_q_treats_like_wildcards_as_plain_text(client, db):
    category = make_category(db, "laptop-repair")
    make_provider(db, category, "Ali Tech")
    make_provider(db, category, "100% Clean")
    make_provider(db, category, "fix_it now")

    # Unescaped, "%%" and "__" would each match every name.
    assert names(search(client, q="%%")) == []
    assert names(search(client, q="__")) == []
    assert names(search(client, q="0%")) == ["100% Clean"]
    assert names(search(client, q="x_i")) == ["fix_it now"]
    assert names(search(client, q="l_ T")) == []  # "_" must not stand for the "i" in "Ali T"


@pytest.mark.parametrize("bad_q", ["a", "x" * 61])
def test_q_length_is_validated(client, bad_q):
    params = {"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_m": 500, "q": bad_q}
    assert client.get(SEARCH_URL, params=params).status_code == 422


def test_q_accepts_2_and_60_characters(client, db):
    make_provider(db, make_category(db, "laptop-repair"), "Ali Tech")

    assert names(search(client, q="al")) == ["Ali Tech"]
    assert names(search(client, q="x" * 60)) == []


# ---------- B10: health ----------


def test_health_is_503_when_the_database_is_unreachable(client):
    # A real connection attempt to a port where nothing listens.
    dead_engine = create_engine(
        "postgresql+psycopg://nobody:nothing@127.0.0.1:1/nowhere",
        connect_args={"connect_timeout": 2},
    )

    def get_dead_db():
        with Session(dead_engine) as session:
            yield session

    app.dependency_overrides[get_db] = get_dead_db
    try:
        response = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unreachable"}
    # And it recovers once the database is back.
    assert client.get("/api/v1/health").json() == {"status": "ok"}


# ---------- B11: rate limits ----------


def test_rate_limiter_allows_the_limit_then_reports_the_wait(clock):
    limiter = RateLimiter(clock=clock)

    for _ in range(3):
        assert limiter.seconds_to_wait("key", limit=3, window_seconds=60) == 0
        clock.advance(10)  # requests at t=0, 10, 20

    # t=30: full. The first request (t=0) leaves the window at t=60.
    assert limiter.seconds_to_wait("key", limit=3, window_seconds=60) == 30
    assert limiter.seconds_to_wait("other key", limit=3, window_seconds=60) == 0

    clock.advance(30)  # t=60: there is room again
    assert limiter.seconds_to_wait("key", limit=3, window_seconds=60) == 0


def test_rate_limiter_forgets_old_keys_instead_of_growing_forever(clock, monkeypatch):
    monkeypatch.setattr("app.rate_limit.CLEANUP_THRESHOLD", 5)
    limiter = RateLimiter(clock=clock)
    for number in range(4):
        limiter.seconds_to_wait(f"visitor-{number}", limit=3, window_seconds=60)

    clock.advance(11 * 60)
    limiter.seconds_to_wait("newcomer", limit=3, window_seconds=60)
    limiter.seconds_to_wait("second newcomer", limit=3, window_seconds=60)

    assert set(limiter._hits) == {"newcomer", "second newcomer"}


def test_contact_events_are_limited_to_30_per_minute(client, db, clock):
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/contact-events"

    for _ in range(30):
        assert client.post(url, json={"type": "view"}).status_code == 204
    blocked = client.post(url, json={"type": "view"})

    assert blocked.status_code == 429
    assert isinstance(blocked.json()["detail"], str)
    assert blocked.headers["Retry-After"] == "60"

    clock.advance(61)
    assert client.post(url, json={"type": "view"}).status_code == 204


def test_review_and_profile_writes_are_limited_to_20_per_minute(client, db, clock):
    category = make_category(db, "plumber")
    provider = make_provider(db, category)
    headers = auth_headers(uuid.uuid4())
    review_url = f"/api/v1/providers/{provider.id}/reviews/mine"
    client.post("/api/v1/me/provider", json=valid_provider_body(category.id), headers=headers)

    # 1 create above + 9 updates + 10 reviews = 20 writes: all allowed.
    for _ in range(9):
        response = client.patch("/api/v1/me/provider", json={"name": "New"}, headers=headers)
        assert response.status_code == 200
    for _ in range(10):
        assert client.put(review_url, json=REVIEW_BODY, headers=headers).status_code == 200

    # The 21st is refused on every limited route.
    blocked = [
        client.put(review_url, json=REVIEW_BODY, headers=headers),
        client.patch("/api/v1/me/provider", json={"name": "Newer"}, headers=headers),
        client.post("/api/v1/me/provider", json=valid_provider_body(category.id), headers=headers),
    ]
    for response in blocked:
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1

    # Reading is never limited, and writing works again a minute later.
    assert client.get("/api/v1/me/provider", headers=headers).status_code == 200
    clock.advance(61)
    assert client.put(review_url, json=REVIEW_BODY, headers=headers).status_code == 200


def test_repeated_contact_event_is_204_but_stored_once(client, db, clock):
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/contact-events"

    for _ in range(3):
        assert client.post(url, json={"type": "view"}).status_code == 204
    assert count_events(db, provider) == 1

    # A different type is a different event.
    client.post(url, json={"type": "call"})
    assert count_events(db, provider) == 2

    # 9 minutes later: still a repeat. After 10 minutes: counted again.
    clock.advance(9 * 60)
    client.post(url, json={"type": "view"})
    assert count_events(db, provider) == 2
    clock.advance(61)
    client.post(url, json={"type": "view"})
    assert count_events(db, provider) == 3


def test_dedup_is_per_provider(client, db):
    category = make_category(db, "plumber")
    first = make_provider(db, category)
    second = make_provider(db, category)

    client.post(f"/api/v1/providers/{first.id}/contact-events", json={"type": "view"})
    client.post(f"/api/v1/providers/{second.id}/contact-events", json={"type": "view"})

    assert count_events(db, first) == 1
    assert count_events(db, second) == 1


def test_forwarded_header_is_ignored_unless_trust_proxy_is_on(client, db, monkeypatch):
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/contact-events"

    def post_from(address: str):
        headers = {"X-Forwarded-For": f"{address}, 10.0.0.1"}
        return client.post(url, json={"type": "view"}, headers=headers)

    # TRUST_PROXY off: the header is not believed, so both count as one client.
    post_from("203.0.113.1")
    post_from("203.0.113.2")
    assert count_events(db, provider) == 1

    # TRUST_PROXY on, two proxies in front: the client is second from the right.
    monkeypatch.setattr(settings, "trust_proxy", True)
    monkeypatch.setattr(settings, "proxy_hops", 2)
    post_from("203.0.113.1")
    post_from("203.0.113.2")
    post_from("203.0.113.2")
    assert count_events(db, provider) == 3


def test_limits_are_per_ip_when_behind_a_proxy(client, db, monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy", True)
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/contact-events"
    busy = {"X-Forwarded-For": "203.0.113.1"}
    quiet = {"X-Forwarded-For": "203.0.113.2"}

    for _ in range(30):
        client.post(url, json={"type": "view"}, headers=busy)

    assert client.post(url, json={"type": "view"}, headers=busy).status_code == 429
    assert client.post(url, json={"type": "view"}, headers=quiet).status_code == 204


def test_client_cannot_fake_its_ip_by_sending_the_header_itself(client, db, monkeypatch):
    # One trusted proxy: it appends the real address on the right. Whatever the
    # client put on the left must not give it a fresh rate-limit allowance.
    monkeypatch.setattr(settings, "trust_proxy", True)
    monkeypatch.setattr(settings, "proxy_hops", 1)
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/contact-events"

    for attempt in range(30):
        headers = {"X-Forwarded-For": f"198.51.100.{attempt}, 203.0.113.9"}
        client.post(url, json={"type": "view"}, headers=headers)

    headers = {"X-Forwarded-For": "198.51.100.200, 203.0.113.9"}
    assert client.post(url, json={"type": "view"}, headers=headers).status_code == 429


# ---------- B12: admin page ----------


def test_admin_page_is_html_without_secrets(client):
    response = client.get("/admin")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    page = response.text
    assert "Haddak admin" in page
    assert TEST_ADMIN_KEY not in page
    assert TEST_JWT_SECRET not in page
    assert settings.database_url not in page
    # Provider data must be written with textContent, never as HTML.
    assert "innerHTML" not in page
    assert "document.write" not in page
    # Self-contained: nothing loaded from other sites, key never stored.
    assert "<script src" not in page
    assert "<link" not in page
    assert "localStorage" not in page
    assert "sessionStorage" not in page
    assert "document.cookie" not in page
    assert "connect-src 'self'" in response.headers["content-security-policy"]


def test_admin_page_does_not_open_the_admin_api(client):
    assert client.get("/api/v1/admin/providers").status_code == 401


# ---------- B13: request logging ----------


def test_each_request_is_logged_without_position_or_secrets(client, db, caplog):
    owner_id = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)
    token_headers = auth_headers(owner_id)
    token = token_headers["Authorization"].removeprefix("Bearer ")

    with caplog.at_level(logging.INFO, logger="haddak.requests"):
        search(client, q="secret-search-words")
        client.get("/api/v1/me/provider", headers=token_headers)
        client.get("/api/v1/admin/providers", headers={"X-Admin-Key": TEST_ADMIN_KEY})
        client.get("/api/v1/providers/not-a-uuid")

    lines = [record.getMessage() for record in caplog.records if record.name == "haddak.requests"]
    assert len(lines) == 4
    assert lines[0].startswith("GET /api/v1/providers/search 200 ")
    assert lines[0].endswith("ms")
    assert lines[1].startswith("GET /api/v1/me/provider 200 ")
    assert lines[2].startswith("GET /api/v1/admin/providers 200 ")
    assert lines[3].startswith("GET /api/v1/providers/not-a-uuid 422 ")

    everything = "\n".join(lines)
    for private_text in (str(CENTER_LAT), str(CENTER_LNG), "lat=", "secret-search-words"):
        assert private_text not in everything
    assert token not in everything
    assert TEST_ADMIN_KEY not in everything


# ---------- B15: production startup check ----------

GOOD_KEY = "a-long-random-admin-key-1234567890"
GOOD_SECRET = "a-long-random-jwt-secret-1234567890"
JWKS_URL = "https://example.supabase.co/auth/v1/.well-known/jwks.json"


def make_settings(**values) -> Settings:
    # _env_file=None: ignore the developer's local .env file.
    defaults = {"supabase_jwt_secret": "", "supabase_jwks_url": "", "admin_api_key": ""}
    return Settings(_env_file=None, **{**defaults, **values})


@pytest.mark.parametrize(
    "values",
    [
        {"admin_api_key": "", "supabase_jwt_secret": GOOD_SECRET},
        {"admin_api_key": "change-me-too", "supabase_jwt_secret": GOOD_SECRET},
        {"admin_api_key": "CHANGE-ME", "supabase_jwks_url": JWKS_URL},
        {"admin_api_key": GOOD_KEY},  # neither JWT setting
        {"admin_api_key": GOOD_KEY, "supabase_jwt_secret": "change-me-to-a-long-random-string"},
    ],
)
def test_production_refuses_to_start_with_unsafe_settings(values):
    unsafe = make_settings(environment="production", **values)

    with pytest.raises(RuntimeError, match="Refusing to start in production"):
        check_startup_settings(unsafe)


@pytest.mark.parametrize(
    "values",
    [
        {"admin_api_key": GOOD_KEY, "supabase_jwt_secret": GOOD_SECRET},
        {"admin_api_key": GOOD_KEY, "supabase_jwks_url": JWKS_URL},
    ],
)
def test_production_starts_with_real_settings(values):
    check_startup_settings(make_settings(environment="Production", **values))


def test_development_starts_even_with_placeholders():
    relaxed = make_settings(environment="development", admin_api_key="change-me-too")

    assert production_problems(relaxed) == []
    check_startup_settings(relaxed)


def test_fake_clock_is_installed_for_every_test(clock):
    # Guards the test setup itself: without this, tests would share limits.
    from app.rate_limit import limiter

    assert isinstance(limiter.clock, FakeClock)
    assert limiter.clock is clock
