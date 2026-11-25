"""Reliability: health checks, error answers, database pool and timeouts,
request ids, caching, indexes, migrations, the assistant under failure,
account deletion safety and the retention script.

Audit findings H2, M1, M2, M4, M4b, M6, M7, M8, L2, L3, L4, L6, L8, L10
(see docs/SYSTEM_DESIGN.md §6 and §7).
"""

import logging
import re
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.config import settings
from app.db import engine, get_db
from app.main import app
from app.models import AssistLog, AssistQuota, Provider, Review, Story
from app.services import account_deletion
from app.services.assist import ai_client, service
from scripts.retention import run_retention
from tests.conftest import (
    BACKEND_DIR,
    CENTER_LAT,
    CENTER_LNG,
    TEST_DATABASE_URL,
    auth_headers,
    make_category,
    make_provider,
    search,
)

# Captured when this file is imported, before conftest's block_real_ai
# fixture replaces get_client for each test.
REAL_GET_CLIENT = ai_client.get_client

REPO_DIR = BACKEND_DIR.parent


@contextmanager
def recorded_statements(target=engine):
    """Collects the SQL sent through `target` (an engine, or the Engine class
    for every engine) while the block runs."""
    statements: list[str] = []

    def record(_conn, _cursor, statement, _params, _context, _many):
        statements.append(statement)

    event.listen(target, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(target, "before_cursor_execute", record)


@contextmanager
def overridden_db(session_factory):
    def get_other_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = get_other_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)


# ---------- H2 / L4: liveness and health ----------


def test_live_does_not_touch_the_db(client):
    with recorded_statements() as statements:
        response = client.get("/api/v1/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert statements == []


def test_live_answers_even_when_the_database_is_unreachable(client):
    dead = create_engine(
        "postgresql+psycopg://nobody:nothing@127.0.0.1:1/nowhere",
        connect_args={"connect_timeout": 2},
    )
    with overridden_db(lambda: Session(dead)):
        assert client.get("/api/v1/live").status_code == 200


# ---------- L4: errors keep the {"detail"} shape ----------


def test_db_error_returns_json_503(client):
    dead = create_engine(
        "postgresql+psycopg://nobody:nothing@127.0.0.1:1/nowhere",
        connect_args={"connect_timeout": 2},
    )
    with overridden_db(lambda: Session(dead)):
        response = client.get("/api/v1/categories")
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    assert "busy or unreachable" in response.json()["detail"]
    assert response.headers["x-request-id"]


def test_pool_timeout_returns_503_json(client):
    # A pool of exactly one connection, with a very short wait.
    tiny = create_engine(TEST_DATABASE_URL, pool_size=1, max_overflow=0, pool_timeout=0.1)
    held = tiny.connect()  # takes the only connection
    try:
        with overridden_db(lambda: Session(tiny)):
            response = client.get("/api/v1/categories")
    finally:
        held.close()
        tiny.dispose()
    assert response.status_code == 503
    assert "busy or unreachable" in response.json()["detail"]


def test_read_only_database_error_returns_json_503(client, db):
    make_category(db, "plumber")

    # Simulates the error Postgres raises in a database Supabase switched to
    # read-only (over the free plan's size).
    def refuse_writes(_conn, _cursor, statement, _params, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            raise psycopg.errors.ReadOnlySqlTransaction("read-only transaction")

    event.listen(engine, "before_cursor_execute", refuse_writes)
    try:
        response = client.get("/api/v1/categories")
    finally:
        event.remove(engine, "before_cursor_execute", refuse_writes)
    assert response.status_code == 503


def test_unexpected_error_returns_json_500():
    def broken_db():
        raise RuntimeError("a bug")
        yield  # pragma: no cover  (makes this a generator, like get_db)

    app.dependency_overrides[get_db] = broken_db
    try:
        # raise_server_exceptions=False: see the answer a phone would get,
        # instead of the test client re-raising the error.
        response = TestClient(app, raise_server_exceptions=False).get("/api/v1/categories")
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong on our side. Try again in a moment."}


# ---------- M1: pool and timeouts ----------


def test_engine_has_connect_timeout_and_a_small_pool(db):
    assert engine.pool.size() == settings.db_pool_size
    assert engine.pool._max_overflow == settings.db_max_overflow
    assert engine.pool._timeout == settings.db_pool_timeout_seconds <= 10
    assert engine.pool._recycle == settings.db_pool_recycle_seconds
    # What psycopg really connected with.
    parameters = db.connection().connection.dbapi_connection.info.get_parameters()
    assert parameters["connect_timeout"] == str(settings.db_connect_timeout_seconds)


def test_every_connection_gets_the_statement_timeout(db):
    assert db.scalar(text("SHOW statement_timeout")) == "8s"
    assert settings.db_statement_timeout_ms == 8000


# ---------- M7: request id ----------


def test_request_id_is_made_returned_and_logged(client, caplog):
    with caplog.at_level(logging.INFO, logger="haddak.requests"):
        response = client.get("/api/v1/live")
    request_id = response.headers["x-request-id"]
    assert re.fullmatch(r"[0-9a-f]{16}", request_id)
    assert any(f" req={request_id} " in record.getMessage() for record in caplog.records)


def test_request_id_from_the_caller_is_kept(client):
    response = client.get("/api/v1/live", headers={"X-Request-ID": "app-1234_abc"})
    assert response.headers["x-request-id"] == "app-1234_abc"


def test_unsafe_request_id_is_replaced(client, caplog):
    with caplog.at_level(logging.INFO, logger="haddak.requests"):
        response = client.get("/api/v1/live", headers={"X-Request-ID": "bad id\tFAKE LOG"})
    assert response.headers["x-request-id"] != "bad id\tFAKE LOG"
    assert not any("FAKE LOG" in record.getMessage() for record in caplog.records)


# ---------- L10 / M8: categories ----------


def test_categories_response_is_cacheable(client, db):
    make_category(db, "plumber")
    response = client.get("/api/v1/categories")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"


def test_category_children_are_read_once_per_process(client, db):
    parent = make_category(db, "home")
    child = make_category(db, "plumber", parent=parent)
    make_provider(db, child, "Abu Hassan Plumbing")

    first = search(client, category_id=parent.id)
    with recorded_statements() as statements:
        second = search(client, category_id=parent.id)

    assert [i["name"] for i in first["items"]] == ["Abu Hassan Plumbing"]
    assert second["items"] == first["items"]
    assert not any("FROM categories" in statement for statement in statements)


def test_an_unknown_category_still_matches_nothing(client, db):
    make_provider(db, make_category(db, "plumber"), "Abu Hassan Plumbing")
    assert search(client, category_id=999)["items"] == []


# ---------- M8: the total comes with the page ----------


def test_search_total_counts_all_matches_beyond_the_page(client, db):
    plumber = make_category(db, "plumber")
    for number in range(5):
        make_provider(db, plumber, f"Plumber {number}", distance_m=50 * number)

    with recorded_statements() as statements:
        body = search(client, limit=2)

    assert len(body["items"]) == 2
    assert body["total"] == 5
    assert sum("count(*)" in statement for statement in statements) == 1
    assert any("OVER ()" in statement for statement in statements)


def test_page_past_the_end_still_reports_the_total(client, db):
    plumber = make_category(db, "plumber")
    for number in range(3):
        make_provider(db, plumber, f"Plumber {number}")

    body = search(client, limit=2, offset=10)

    assert body["items"] == []
    assert body["total"] == 3


def test_no_match_has_total_zero(client, db):
    assert search(client)["total"] == 0


# ---------- L2 / L3: indexes ----------


def explain(db, sql: str) -> str:
    db.execute(text("SET LOCAL enable_seqscan = off"))
    plan = "\n".join(row[0] for row in db.execute(text("EXPLAIN " + sql)))
    db.rollback()
    return plan


def test_text_search_uses_trigram_index(db):
    make_provider(db, make_category(db, "laptop-repair"), "Ali Tech")
    plan = explain(db, "SELECT id FROM providers WHERE normalize_name(name) LIKE '%ali%'")
    assert "providers_name_trgm_idx" in plan
    plan = explain(db, "SELECT id FROM providers WHERE normalize_name(area_name) LIKE '%hreik%'")
    assert "providers_area_name_trgm_idx" in plan


def test_stories_feed_can_use_the_expires_index(db):
    plan = explain(db, "SELECT provider_id FROM stories WHERE expires_at > now()")
    assert "stories_expires_idx" in plan


def test_new_indexes_are_valid(db):
    valid = dict(
        db.execute(
            text(
                "SELECT c.relname, i.indisvalid FROM pg_index i "
                "JOIN pg_class c ON c.oid = i.indexrelid "
                "WHERE c.relname IN ('providers_name_trgm_idx', "
                "'providers_area_name_trgm_idx', 'stories_expires_idx')"
            )
        ).all()
    )
    assert valid == {
        "providers_name_trgm_idx": True,
        "providers_area_name_trgm_idx": True,
        "stories_expires_idx": True,
    }


# ---------- L8: migrations ----------


def test_env_sets_lock_timeout_and_takes_the_migration_lock():
    with recorded_statements(Engine) as statements:
        # Already at head: nothing to migrate, but env.py still connects.
        command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")
    joined = "\n".join(statements)
    assert "SET statement_timeout = '10min'" in joined
    assert "SET lock_timeout = '5s'" in joined
    assert "pg_advisory_lock" in joined
    assert "pg_advisory_unlock" in joined
    # The advisory lock is taken before lock_timeout applies, so a second
    # container waits for the first instead of failing after 5 s.
    lock_at = next(i for i, s in enumerate(statements) if "pg_advisory_lock" in s)
    timeout_at = next(i for i, s in enumerate(statements) if "lock_timeout" in s)
    assert lock_at < timeout_at


# ---------- M2 / L10: the Claude client ----------


def test_ai_client_is_reused_and_cannot_outlast_the_app(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key-not-real")
    monkeypatch.setattr(settings, "assist_model", "claude-haiku-5-5")
    monkeypatch.setattr(settings, "assist_model_arabizi", "")
    REAL_GET_CLIENT.cache_clear()
    try:
        first = REAL_GET_CLIENT()
        assert REAL_GET_CLIENT() is first
        assert first.max_retries == 0
        assert first.timeout.read == 6.0
        assert first.timeout.connect == 2.0
    finally:
        REAL_GET_CLIENT.cache_clear()


def assistant_sentence(client, text: str) -> dict:
    response = client.post(
        "/api/v1/assist", json={"text": text, "lat": CENTER_LAT, "lng": CENTER_LNG, "lang": "en"}
    )
    assert response.status_code == 200, response.text
    return response.json()


def ai_must_not_be_called():
    raise AssertionError("the AI was called")


def test_full_ai_slots_fall_back_to_keywords_without_using_the_allowance(client, db, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key-not-real")
    monkeypatch.setattr(settings, "assist_model", "claude-haiku-5-5")
    monkeypatch.setattr(settings, "assist_model_arabizi", "")
    monkeypatch.setattr("app.services.assist.ai_client.get_client", ai_must_not_be_called)
    taken = 0
    while ai_client._ai_slots.acquire(blocking=False):
        taken += 1
    try:
        body = assistant_sentence(client, "baddé sankari 2arib")
    finally:
        for _ in range(taken):
            ai_client._ai_slots.release()

    assert taken == ai_client.MAX_CONCURRENT_AI_CALLS
    assert body["kind"] in ("results", "unavailable")
    assert db.scalar(select(AssistQuota.used).limit(1)) is None


def test_budget_reached_is_logged_as_an_error_once(client, db, monkeypatch, caplog):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key-not-real")
    monkeypatch.setattr(settings, "assist_model", "claude-haiku-5-5")
    monkeypatch.setattr(settings, "assist_model_arabizi", "")
    monkeypatch.setattr(settings, "assist_monthly_budget_usd", 1.0)
    monkeypatch.setattr(service, "_reported_budgets", set())
    monkeypatch.setattr("app.services.assist.ai_client.get_client", ai_must_not_be_called)
    db.add(AssistLog(source="ai", model="claude-haiku-5-5", cost_usd=1.0, kind="results",
                     text_hash="x"))  # fmt: skip
    db.commit()

    with caplog.at_level(logging.WARNING, logger="haddak.assist"):
        assistant_sentence(client, "baddé sankari")
        assistant_sentence(client, "baddé kahraba")

    budget_records = [r for r in caplog.records if "monthly budget reached" in r.getMessage()]
    assert [r.levelno for r in budget_records] == [logging.ERROR, logging.WARNING]


# ---------- M6: the assistant survives a failed log write ----------


def test_assist_answers_even_if_log_write_fails(client, db, caplog):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Hassan Plumbing", distance_m=200)

    def read_only_log(_conn, _cursor, statement, _params, _context, _many):
        if statement.lstrip().upper().startswith("INSERT INTO ASSIST_LOG"):
            raise psycopg.errors.ReadOnlySqlTransaction("read-only transaction")

    event.listen(engine, "before_cursor_execute", read_only_log)
    try:
        with caplog.at_level(logging.ERROR, logger="haddak.assist"):
            body = assistant_sentence(client, "plumber")
    finally:
        event.remove(engine, "before_cursor_execute", read_only_log)

    assert body["kind"] == "results"
    assert [item["name"] for item in body["results"]["items"]] == ["Abu Hassan Plumbing"]
    assert db.scalar(select(AssistLog.id).limit(1)) is None
    assert any("could not write assist_log" in r.getMessage() for r in caplog.records)


# ---------- M4b / L6: account deletion ----------


def leave_review(client, user_id, provider, rating: int) -> None:
    response = client.put(
        f"/api/v1/providers/{provider.id}/reviews/mine",
        json={"rating": rating, "comment": "", "author_name": "Sam"},
        headers=auth_headers(user_id),
    )
    assert response.status_code == 200, response.text


def test_delete_account_in_production_without_auth_function_is_503_and_keeps_data(
    client, db, monkeypatch
):
    me = uuid.uuid4()
    category = make_category(db, "plumber")
    mine = make_provider(db, category, "My shop", owner_user_id=me)
    other = make_provider(db, category, "Other shop")
    leave_review(client, me, other, 4)
    # Only this module believes it runs in production (the test database has
    # no haddak_private.delete_auth_user, like a forgotten rebuild step).
    monkeypatch.setattr(account_deletion, "settings", SimpleNamespace(is_production=lambda: True))

    response = client.delete("/api/v1/me", headers=auth_headers(me))

    assert response.status_code == 503
    assert "Nothing was deleted" in response.json()["detail"]
    db.expire_all()
    assert db.get(Provider, mine.id) is not None
    assert db.scalar(select(Review.id).where(Review.user_id == me)) is not None


def test_deleting_account_locks_reviewed_providers(client, db):
    me = uuid.uuid4()
    category = make_category(db, "plumber")
    first = make_provider(db, category, "First")
    second = make_provider(db, category, "Second")
    leave_review(client, me, first, 2)
    leave_review(client, me, second, 4)

    with recorded_statements() as statements:
        assert client.delete("/api/v1/me", headers=auth_headers(me)).status_code == 204

    lock_at = next(
        i
        for i, s in enumerate(statements)
        if "FROM providers" in s and "FOR UPDATE" in s and "ORDER BY providers.id" in s
    )
    delete_at = next(i for i, s in enumerate(statements) if s.startswith("DELETE FROM reviews"))
    assert lock_at < delete_at


# ---------- M6: retention ----------


def add_contact_event(db, provider_id, kind: str, when: datetime) -> None:
    db.execute(
        text(
            "INSERT INTO contact_events (provider_id, type, created_at) "
            "VALUES (:provider_id, :type, :created_at)"
        ),
        {"provider_id": provider_id, "type": kind, "created_at": when},
    )


def fill_old_and_new_rows(db, now: datetime) -> Provider:
    provider = make_provider(db, make_category(db, "plumber"))
    db.add_all(
        [
            Story(provider_id=provider.id, text="old", expires_at=now - timedelta(days=40)),
            Story(provider_id=provider.id, text="recent", expires_at=now - timedelta(days=5)),
            AssistLog(
                source="direct",
                kind="results",
                text_hash="old",
                created_at=now - timedelta(days=200),
            ),  # fmt: skip
            AssistLog(
                source="direct",
                kind="results",
                text_hash="new",
                created_at=now - timedelta(days=10),
            ),  # fmt: skip
        ]
    )
    five_months_ago = now - timedelta(days=150)
    for _ in range(3):
        add_contact_event(db, provider.id, "view", five_months_ago)
    add_contact_event(db, provider.id, "call", five_months_ago)
    add_contact_event(db, provider.id, "call", now - timedelta(days=2))
    db.commit()
    return provider


def table_count(db, table: str) -> int:
    return db.scalar(text(f"SELECT count(*) FROM {table}"))


def test_retention_dry_run_changes_nothing(db):
    now = datetime(2026, 11, 25, 12, tzinfo=UTC)
    fill_old_and_new_rows(db, now)

    report = run_retention(db, now, apply=False)

    assert report.stories_deleted == 1
    assert report.assist_log_deleted == 1
    assert report.contact_events_rolled_up == 4
    assert table_count(db, "stories") == 2
    assert table_count(db, "assist_log") == 2
    assert table_count(db, "contact_events") == 5
    assert table_count(db, "contact_event_months") == 0


def test_retention_apply_deletes_old_rows_and_keeps_monthly_totals(db):
    now = datetime(2026, 11, 25, 12, tzinfo=UTC)
    provider = fill_old_and_new_rows(db, now)

    run_retention(db, now, apply=True)

    assert [s.text for s in db.scalars(select(Story))] == ["recent"]
    assert table_count(db, "assist_log") == 1
    assert table_count(db, "contact_events") == 1  # this month's call stays
    totals = db.execute(
        text("SELECT provider_id, month, type, count FROM contact_event_months ORDER BY type")
    ).all()
    month = (now - timedelta(days=150)).date().replace(day=1)
    assert totals == [(provider.id, month, "call", 1), (provider.id, month, "view", 3)]

    again = run_retention(db, now, apply=True)  # safe to run twice
    assert again.contact_events_rolled_up == 0
    assert again.stories_deleted == 0


# ---------- M4: the role script is the written record ----------


def test_role_setup_script_matches_docs():
    script = (REPO_DIR / "supabase" / "role_setup.sql").read_text(encoding="utf-8")
    assert re.search(r"alter role haddak_api connection limit 20;", script)
    assert "alter role haddak_api set statement_timeout = '30s';" in script
    assert "alter role haddak_api set idle_in_transaction_session_timeout = '60s';" in script
    assert "nosuperuser" in script
    # The repository is public: never a password in the file.
    assert not re.search(r"password\s+'[^.']", script, flags=re.IGNORECASE)

    design = (REPO_DIR / "docs" / "SYSTEM_DESIGN.md").read_text(encoding="utf-8")
    assert "role_setup.sql" in design
    assert "connection limit 20" in design.lower()
    deploy = (REPO_DIR / "docs" / "DEPLOY.md").read_text(encoding="utf-8")
    assert "supabase/role_setup.sql" in deploy


def test_pool_fits_inside_the_role_connection_limit():
    # One instance's pool + a migration + a backup + two people with a SQL
    # client must stay under the role's 20 (docs/SYSTEM_DESIGN.md §6).
    per_instance = settings.db_pool_size + settings.db_max_overflow
    assert per_instance + 1 + 1 + 2 <= 15


@pytest.mark.parametrize("path", ["/api/v1/live", "/api/v1/health"])
def test_both_health_endpoints_answer_ok(client, path):
    assert client.get(path).json() == {"status": "ok"}
