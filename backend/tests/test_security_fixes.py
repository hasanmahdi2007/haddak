"""Fixes from the security audit of 2026-11-25 (backend_security.md and
system_design.md): read limits, per-user write limits, IPv6 /64, the
sign-in bridge page, storage-only links, honest contact counts, bounded
paging, Sentry privacy and the production startup checks."""

import logging
import uuid
from contextlib import contextmanager

import pytest
from sqlalchemy import event, func, select, text

from app import rate_limit
from app.config import Settings, production_problems, settings
from app.db import engine
from app.error_tracking import init_error_tracking, scrub
from app.models import ContactEvent, Provider
from app.routers import me as me_router
from tests.conftest import (
    ADMIN_HEADERS,
    CENTER_LAT,
    CENTER_LNG,
    auth_headers,
    make_category,
    make_provider,
    valid_provider_body,
)

ME_URL = "/api/v1/me/provider"
PROJECT = "https://abcdefgh.supabase.co"
PHOTO = f"{PROJECT}/storage/v1/object/public/provider-photos/user-1/1-abc.jpg"
PROOF = f"{PROJECT}/storage/v1/object/sign/verification-docs/user-1/1-abc.jpg?token=xyz"


@contextmanager
def count_statements():
    """Counts the SQL statements sent to the database inside the block."""
    statements: list[str] = []

    def remember(_conn, _cursor, statement, *_args):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", remember)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", remember)


# ---------- production startup checks (L2, L8, M3) ----------


def production(**values) -> Settings:
    safe = {
        "environment": "production",
        "admin_api_key": "a-long-random-admin-key-1234567890",
        "supabase_jwks_url": f"{PROJECT}/auth/v1/.well-known/jwks.json",
        "supabase_jwt_secret": "",
        "allow_dev_tokens": False,
        "assist_quota_secret": "a-long-random-quota-secret-1234567890",
        "supabase_url": PROJECT,
        "cors_origins": "",
        "database_url": "postgresql://u:p@db.example.com:5432/postgres?sslmode=require",
    }
    return Settings(_env_file=None, **{**safe, **values})


def test_safe_production_settings_have_no_problems():
    assert production_problems(production()) == []
    assert production_problems(production(cors_origins="https://haddak.app")) == []


def test_production_refuses_wildcard_cors():
    problems = production_problems(production(cors_origins="*"))
    assert any("CORS_ORIGINS" in problem for problem in problems)


@pytest.mark.parametrize("query", ["", "?sslmode=prefer", "?sslmode=disable", "?sslmode=allow"])
def test_production_requires_sslmode(query):
    url = f"postgresql://u:p@db.example.com:5432/postgres{query}"
    problems = production_problems(production(database_url=url))
    assert any("sslmode" in problem for problem in problems)
    # The message never repeats the URL (it holds a password).
    assert not any("u:p@" in problem for problem in problems)


def test_production_accepts_verify_full():
    url = "postgresql://u:p@db.example.com:5432/postgres?sslmode=verify-full&x=1"
    assert production_problems(production(database_url=url)) == []


def test_production_requires_supabase_url():
    problems = production_problems(production(supabase_url=""))
    assert any("SUPABASE_URL" in problem for problem in problems)


# ---------- Sentry (M2) ----------


def test_sentry_event_has_no_frame_variables():
    event_data = {
        "exception": {
            "values": [{"stacktrace": {"frames": [{"function": "search", "vars": {"lat": 33.85}}]}}]
        },
        "threads": {"values": [{"stacktrace": {"frames": [{"vars": {"text": "hi"}}]}}]},
    }
    cleaned = scrub(event_data, {})
    frame = cleaned["exception"]["values"][0]["stacktrace"]["frames"][0]
    assert "vars" not in frame
    assert frame["function"] == "search"
    assert "vars" not in cleaned["threads"]["values"][0]["stacktrace"]["frames"][0]


def test_sentry_is_started_without_local_variables(monkeypatch):
    calls = []
    monkeypatch.setattr("app.error_tracking.sentry_sdk.init", lambda **kw: calls.append(kw))
    assert init_error_tracking(Settings(_env_file=None, sentry_dsn="https://k@o1.ingest/1"))
    assert calls[0]["include_local_variables"] is False
    assert calls[0]["send_default_pii"] is False


# ---------- read limits (H1) ----------


def test_search_is_rate_limited_per_ip(client, db, clock):
    params = {"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_m": 500}
    for _ in range(rate_limit.SEARCHES_PER_MINUTE):
        assert client.get("/api/v1/providers/search", params=params).status_code == 200

    blocked = client.get("/api/v1/providers/search", params=params)
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
    # Stories near me share the search allowance; other reads do not.
    assert client.get("/api/v1/stories/nearby", params=params).status_code == 429
    assert client.get("/api/v1/categories").status_code == 200

    clock.advance(61)
    assert client.get("/api/v1/providers/search", params=params).status_code == 200


def test_profile_reads_are_rate_limited_per_ip(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    for _ in range(rate_limit.READS_PER_MINUTE):
        assert client.get("/api/v1/categories").status_code == 200

    for url in (
        f"/api/v1/providers/{provider.id}",
        f"/api/v1/providers/by-slug/{provider.slug}",
        f"/api/v1/providers/{provider.id}/reviews",
        f"/api/v1/providers/{provider.id}/stories",
    ):
        assert client.get(url).status_code == 429


# ---------- per-user write limits, IPv6, X-Forwarded-For (M5) ----------


def test_write_limit_is_per_user_when_signed_in(client, db):
    category = make_category(db, "plumber")
    first, second = uuid.uuid4(), uuid.uuid4()
    for user_id in (first, second):  # same IP (the test client)
        headers = auth_headers(user_id)
        assert (
            client.post(ME_URL, json=valid_provider_body(category.id), headers=headers).status_code
            == 201
        )
        for _ in range(rate_limit.WRITES_PER_MINUTE - 1):
            response = client.patch(ME_URL, json={"name": "New"}, headers=headers)
            assert response.status_code == 200

    # Each one has used up their own 20; neither blocked the other.
    assert client.patch(ME_URL, json={"name": "x"}, headers=auth_headers(first)).status_code == 429


def test_many_accounts_on_one_ip_hit_the_backstop(client, db, monkeypatch):
    monkeypatch.setattr(rate_limit, "IP_BACKSTOP_FACTOR", 2)  # 40 writes per IP
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/follow"

    codes = [client.put(url, headers=auth_headers(uuid.uuid4())).status_code for _ in range(41)]

    assert codes == [204] * 40 + [429]


def test_ipv6_clients_share_a_64_prefix_bucket(client, db, monkeypatch):
    assert rate_limit.limit_address("2001:db8:1:2:aaaa::1") == "2001:db8:1:2::/64"
    assert rate_limit.limit_address("2001:db8:1:2:ffff::9") == "2001:db8:1:2::/64"
    assert rate_limit.limit_address("::ffff:203.0.113.5") == "203.0.113.5"
    assert rate_limit.limit_address("203.0.113.5") == "203.0.113.5"

    monkeypatch.setattr(settings, "trust_proxy", True)
    provider = make_provider(db, make_category(db, "plumber"))
    url = f"/api/v1/providers/{provider.id}/contact-events"
    for number in range(rate_limit.CONTACT_EVENTS_PER_MINUTE):
        headers = {"X-Forwarded-For": f"2001:db8:1:2::{number + 1:x}"}
        assert client.post(url, json={"type": "view"}, headers=headers).status_code == 204

    same_64 = {"X-Forwarded-For": "2001:db8:1:2:dead:beef::1"}
    other_64 = {"X-Forwarded-For": "2001:db8:1:3::1"}
    assert client.post(url, json={"type": "view"}, headers=same_64).status_code == 429
    assert client.post(url, json={"type": "view"}, headers=other_64).status_code == 204


def test_forwarded_for_entry_count_is_logged_once_without_addresses(client, monkeypatch, caplog):
    monkeypatch.setattr(settings, "trust_proxy", True)
    monkeypatch.setattr(rate_limit, "_forwarded_for_logged", False)
    headers = {"X-Forwarded-For": "198.51.100.7, 203.0.113.9"}

    with caplog.at_level(logging.INFO, logger="haddak.rate_limit"):
        client.post("/api/v1/suggestions", json={"name": "Abu Ali"}, headers=headers)
        client.post("/api/v1/suggestions", json={"name": "Abu Ali"}, headers=headers)

    lines = [r.getMessage() for r in caplog.records if r.name == "haddak.rate_limit"]
    assert len(lines) == 1
    assert "carries 2 entries" in lines[0]
    assert "198.51.100.7" not in caplog.text and "203.0.113.9" not in caplog.text


# ---------- /auth/open (H2, mobile H1/L11) ----------


def test_production_refuses_exp_links(client, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    response = client.get(
        "/auth/open", params={"app": "exp://attacker.example:80/--/x", "code": "c"}
    )

    assert response.status_code == 400
    assert "attacker.example" not in response.text
    assert 'data-app=""' in response.text


def test_production_accepts_only_the_app_callback(client, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    good = client.get("/auth/open", params={"app": "haddak://auth-callback", "code": "c"})
    assert good.status_code == 200
    assert 'data-app="haddak://auth-callback"' in good.text

    for other in ("haddak://auth-callback/../evil", "haddak://evil", "https://evil.example"):
        assert client.get("/auth/open", params={"app": other}).status_code == 400


def test_development_still_accepts_expo_go(client):
    link = "exp://192.168.1.20:8081/--/auth-callback"
    response = client.get("/auth/open", params={"app": link})
    assert response.status_code == 200
    assert f'data-app="{link}"' in response.text


def test_repeated_or_strange_app_links_are_refused(client):
    repeated = client.get("/auth/open?app=haddak://auth-callback&app=exp://evil.example/x")
    assert repeated.status_code == 400
    quoted = client.get("/auth/open", params={"app": 'haddak://x"><script>alert(1)</script>'})
    assert quoted.status_code == 400
    assert "<script>alert(1)" not in quoted.text
    assert client.get("/auth/open").status_code == 400


def test_auth_open_forwards_only_the_code_and_error_fields(client):
    page = client.get("/auth/open", params={"app": "haddak://auth-callback"}).text
    assert "['code', 'error', 'error_code', 'error_description']" in page
    # The fragment (where tokens would be) is never appended to the target.
    assert "+ location.hash" not in page
    assert "access_token" not in page


# ---------- links must point into our Storage (M3, mobile M4/L7) ----------


@pytest.fixture
def our_project(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", PROJECT)


def test_photo_url_must_be_our_storage(client, db, our_project):
    category = make_category(db, "plumber")
    headers = auth_headers(uuid.uuid4())
    for bad in (
        "https://tracker.example/p.gif",
        "http://tracker.example/p.gif",
        f"{PROJECT}/storage/v1/object/public/other-bucket/x.jpg",
        f"{PROJECT}.evil.example/storage/v1/object/public/provider-photos/x.jpg",
        PHOTO + "x" * 500,
    ):
        body = valid_provider_body(category.id, photos=[bad], verification_doc_url=None)
        assert client.post(ME_URL, json=body, headers=headers).status_code == 422, bad

    body = valid_provider_body(category.id, photos=[PHOTO], verification_doc_url=PROOF)
    created = client.post(ME_URL, json=body, headers=headers)
    assert created.status_code == 201
    patched = client.patch(
        ME_URL, json={"photos": ["https://tracker.example/p.gif"]}, headers=headers
    )
    assert patched.status_code == 422


def test_proof_url_must_be_our_storage(client, db, our_project):
    category = make_category(db, "pharmacy")
    listing = make_provider(db, category, claimed=False, status="unverified", source="osm")
    url = f"/api/v1/providers/{listing.id}/claim"
    headers = auth_headers(uuid.uuid4())

    for bad in ("https://evil.example/fake-supabase-login", PHOTO, "not a link"):
        response = client.post(url, json={"verification_doc_url": bad}, headers=headers)
        assert response.status_code == 422, bad
    profile = valid_provider_body(
        category.id, photos=[], verification_doc_url="https://evil.example"
    )
    assert client.post(ME_URL, json=profile, headers=headers).status_code == 422

    assert (
        client.post(url, json={"verification_doc_url": PROOF}, headers=headers).status_code == 201
    )


def test_story_image_must_be_our_storage(client, db, our_project):
    owner = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=owner, status="verified")
    url = f"{ME_URL}/stories"
    headers = auth_headers(owner)

    bad = {"text": "Offer", "image_url": "https://tracker.example/p.gif"}
    assert client.post(url, json=bad, headers=headers).status_code == 422
    good = {"text": "Offer", "image_url": PHOTO}
    assert client.post(url, json=good, headers=headers).status_code == 201


def test_without_supabase_url_any_https_link_is_accepted(client, db):
    # Development and the app's mock mode: SUPABASE_URL is empty.
    assert settings.supabase_url == ""
    category = make_category(db, "plumber")
    body = valid_provider_body(category.id, photos=["https://picsum.photos/1.jpg"])
    assert client.post(ME_URL, json=body, headers=auth_headers(uuid.uuid4())).status_code == 201
    body = valid_provider_body(category.id, photos=["http://example.com/1.jpg"])
    assert client.post(ME_URL, json=body, headers=auth_headers(uuid.uuid4())).status_code == 422


# ---------- honest contact counts (M4, system_design L1/M5) ----------


def contact(client, provider, event_type, user_id=None):
    headers = auth_headers(user_id) if user_id else {}
    url = f"/api/v1/providers/{provider.id}/contact-events"
    assert client.post(url, json={"type": event_type}, headers=headers).status_code == 204


def public_count(client, provider) -> int:
    return client.get(f"/api/v1/providers/{provider.id}").json()["contacts_this_month"]


def test_public_count_counts_one_per_user_per_day(client, db, clock):
    provider = make_provider(db, make_category(db, "plumber"), show_contact_count=True)
    first, second = uuid.uuid4(), uuid.uuid4()

    contact(client, provider, "call", first)
    contact(client, provider, "whatsapp", first)  # same person, same day
    clock.advance(11 * 60)
    contact(client, provider, "call", first)  # stored, but not counted publicly again
    contact(client, provider, "call", second)
    assert public_count(client, provider) == 2

    clock.advance(24 * 60 * 60)  # the next day counts again
    contact(client, provider, "call", first)
    assert public_count(client, provider) in (2, 3)  # 3 unless the month just changed


def test_anonymous_taps_count_only_in_private_stats(client, db, clock):
    owner = uuid.uuid4()
    provider = make_provider(
        db, make_category(db, "plumber"), owner_user_id=owner, show_contact_count=True
    )
    for _ in range(3):
        contact(client, provider, "call")
        clock.advance(11 * 60)

    assert public_count(client, provider) == 0
    stats = client.get(f"{ME_URL}/stats", headers=auth_headers(owner)).json()
    assert stats["calls"] == 3


def test_contact_dedup_survives_a_new_limiter_instance(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    contact(client, provider, "view")
    rate_limit.limiter.reset()  # as after a restart: everything in memory is gone
    contact(client, provider, "view")

    stored = db.scalar(select(func.count()).select_from(ContactEvent))
    assert stored == 1


def test_two_signed_in_people_on_one_ip_are_counted_separately(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    contact(client, provider, "view", uuid.uuid4())
    contact(client, provider, "view", uuid.uuid4())

    assert db.scalar(select(func.count()).select_from(ContactEvent)) == 2


def test_dedup_table_holds_no_user_ids_or_addresses(client, db):
    user_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"))
    contact(client, provider, "call", user_id)
    contact(client, provider, "view")

    keys = db.scalars(text("SELECT key_hash FROM contact_event_dedup")).all()
    assert len(keys) == 3  # repeat keys for both taps + the public-count key
    for key in keys:
        assert str(user_id) not in key and "testclient" not in key
        assert len(key) == 64


# ---------- bounded paging and ids (L5, system_design M3) ----------


@pytest.mark.parametrize(
    "url",
    [
        f"/api/v1/providers/search?lat={CENTER_LAT}&lng={CENTER_LNG}&radius_m=500&offset=10001",
        f"/api/v1/providers/search?lat={CENTER_LAT}&lng={CENTER_LNG}&radius_m=500&offset={10**20}",
        f"/api/v1/providers/search?lat={CENTER_LAT}&lng={CENTER_LNG}&radius_m=500&category_id={2**31}",
        f"/api/v1/providers/{uuid.uuid4()}/reviews?offset=10001",
        "/api/v1/me/following?offset=10001",
        "/api/v1/admin/providers?offset=10001",
        "/api/v1/admin/providers?limit=201",
        "/api/v1/admin/reports?offset=10001",
    ],
)
def test_huge_offset_or_id_is_422(client, url):
    headers = {**ADMIN_HEADERS, **auth_headers(uuid.uuid4())}
    assert client.get(url, headers=headers).status_code == 422


def test_huge_category_id_in_a_body_is_422(client, db):
    body = valid_provider_body(2**31)
    assert client.post(ME_URL, json=body, headers=auth_headers(uuid.uuid4())).status_code == 422
    assert (
        client.post("/api/v1/suggestions", json={"name": "A", "category_id": 2**40}).status_code
        == 422
    )


def test_admin_provider_list_is_paged_and_uses_constant_queries(client, db):
    category = make_category(db, "plumber")
    for number in range(60):
        make_provider(db, category, f"Shop {number}", status="unverified", show_contact_count=True)

    with count_statements() as statements:
        response = client.get("/api/v1/admin/providers?status=unverified", headers=ADMIN_HEADERS)

    body = response.json()
    assert response.status_code == 200
    assert len(body["items"]) == 50  # the default page
    assert body["total"] == 60
    assert len(statements) <= 10

    rest = client.get(
        "/api/v1/admin/providers?status=unverified&limit=50&offset=50", headers=ADMIN_HEADERS
    ).json()
    assert [item["name"] for item in rest["items"]] == [f"Shop {n}" for n in range(50, 60)]
    assert rest["items"][0]["contacts_this_month"] == 0


# ---------- race fixes (system_design L6) ----------


def test_slug_collision_retries(client, db, monkeypatch):
    category = make_category(db, "plumber")
    taken = make_provider(db, category).slug
    slugs = iter([taken, "newcode"])
    # generate_slug checks first; pretend the code was still free at that moment.
    monkeypatch.setattr(me_router, "generate_slug", lambda _db: next(slugs))

    response = client.post(
        ME_URL, json=valid_provider_body(category.id), headers=auth_headers(uuid.uuid4())
    )

    assert response.status_code == 201
    assert db.scalar(select(Provider.slug).where(Provider.name == "Ali Tech")) == "newcode"


def test_owner_and_admin_edits_lock_the_provider_row(client, db):
    owner = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner)

    with count_statements() as owner_statements:
        client.patch(ME_URL, json={"name": "New"}, headers=auth_headers(owner))
    with count_statements() as admin_statements:
        client.patch(
            f"/api/v1/admin/providers/{provider.id}",
            json={"status": "verified"},
            headers=ADMIN_HEADERS,
        )

    assert any("FOR UPDATE" in s and "providers" in s for s in owner_statements)
    assert any("FOR UPDATE" in s and "providers" in s for s in admin_statements)
