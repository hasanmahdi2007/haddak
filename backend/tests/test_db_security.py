"""The database is closed to Supabase's automatic Data API (migration 0012).

Supabase lets anyone with the app's public key read tables in `public`
through its own API, as the roles `anon` and `authenticated`. These tests
check both locks: Row Level Security on every table, and no privileges for
those roles. The local database has no such roles, so the tests create them
inside a transaction that is rolled back at the end.
"""

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import text

from app.db import engine
from tests.conftest import make_category, make_provider

MIGRATION = Path(__file__).resolve().parent.parent / "alembic/versions/0012_lock_public_schema.py"


def load_lock_migration():
    spec = importlib.util.spec_from_file_location("lock_public_schema", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_every_table_has_row_level_security(migrated_database):
    """Fails when a new migration creates a table and forgets
    `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`."""
    lock = load_lock_migration()
    with engine.connect() as connection:
        ours = connection.scalars(text(lock.OUR_TABLES)).all()
        unlocked = connection.scalars(
            text(
                "SELECT c.relname FROM pg_class c WHERE c.relname = ANY(:names) "
                "AND c.relnamespace = 'public'::regnamespace AND NOT c.relrowsecurity"
            ),
            {"names": list(ours)},
        ).all()

    assert "providers" in ours and "assist_quota" in ours
    assert unlocked == []


@pytest.fixture
def supabase_roles():
    """A connection inside a transaction where the Supabase API roles exist,
    as on Supabase. Everything (the roles too) is rolled back afterwards."""
    with engine.connect() as connection:
        transaction = connection.begin()
        for role in ("anon", "authenticated"):
            exists = connection.scalar(
                text("SELECT 1 FROM pg_roles WHERE rolname = :role"), {"role": role}
            )
            if not exists:
                connection.execute(text(f"CREATE ROLE {role} NOLOGIN"))
        yield connection
        transaction.rollback()


def test_the_lock_takes_every_privilege_from_the_api_roles(supabase_roles):
    connection = supabase_roles
    # What Supabase grants by default.
    connection.execute(text("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated"))
    connection.execute(text("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated"))

    connection.execute(text(load_lock_migration().REVOKE_SUPABASE_API_ROLES))

    for role in ("anon", "authenticated"):
        for table in ("providers", "reviews", "claims", "assist_log", "assist_quota"):
            for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                allowed = connection.scalar(
                    text("SELECT has_table_privilege(:role, :table, :privilege)"),
                    {"role": role, "table": f"public.{table}", "privilege": privilege},
                )
                assert not allowed, f"{role} can still {privilege} {table}"


def test_tables_created_later_are_not_granted_to_the_api_roles(supabase_roles):
    connection = supabase_roles
    connection.execute(text(load_lock_migration().REVOKE_SUPABASE_API_ROLES))

    connection.execute(text("CREATE TABLE public.created_later (id int)"))

    allowed = connection.scalar(
        text("SELECT has_table_privilege('anon', 'public.created_later', 'SELECT')")
    )
    assert not allowed


def test_even_with_a_privilege_the_api_roles_see_no_rows(supabase_roles, db):
    """The second lock on its own: if a privilege is ever granted by mistake,
    Row Level Security without policies still shows nothing."""
    make_provider(db, make_category(db, "plumber"), name="Abou Ali")
    connection = supabase_roles
    connection.execute(text("GRANT SELECT ON public.providers TO anon"))

    connection.execute(text("SET LOCAL ROLE anon"))
    visible = connection.scalar(text("SELECT count(*) FROM public.providers"))
    connection.execute(text("RESET ROLE"))

    assert visible == 0
    # Our backend (the owner) still sees the row.
    assert connection.scalar(text("SELECT count(*) FROM public.providers")) == 1


def test_every_function_has_a_fixed_search_path(migrated_database):
    """Fails when a migration creates a function without `SET search_path`.
    Functions that belong to an extension (PostGIS, pg_trgm) are not ours."""
    with engine.connect() as connection:
        loose = connection.scalars(
            text(
                """
                SELECT p.proname FROM pg_proc p
                WHERE p.pronamespace = 'public'::regnamespace
                  AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) setting
                      WHERE setting LIKE 'search_path=%'
                  )
                """
            )
        ).all()

    assert loose == []


def test_normalize_name_still_works_with_its_fixed_search_path(db):
    assert db.scalar(text("SELECT normalize_name('Jounié')")) == "jounie"
