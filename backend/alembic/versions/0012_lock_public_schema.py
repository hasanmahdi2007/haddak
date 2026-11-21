"""Close Haddak's tables to Supabase's automatic Data API.

Supabase publishes every table in the `public` schema through its Data API
(PostgREST). Anyone holding the project's public "anon" key can call it, and
that key ships inside every copy of the app. Haddak never uses that API: the
app talks only to our backend, which connects as the owner of the tables.
So two independent locks, in case one is ever undone by mistake:

1. Row Level Security ON for every table we own, with NO policies. For the
   anon and authenticated roles that means "no rows, ever". Our backend is
   not affected: a table's owner skips Row Level Security (unless FORCEd).
2. The anon and authenticated roles lose every privilege on our tables,
   sequences and functions, including the ones created later (default
   privileges).

On plain Postgres (local Docker, tests) the anon/authenticated roles do not
exist: step 2 is skipped, step 1 still runs so local behaves like production.

Every later migration that creates a table must also run
`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`; tests/test_db_security.py
fails when one is forgotten.

Revision ID: 0012
Revises: 0011
"""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

# Tables in `public` owned by the role running the migration. Tables that
# belong to an extension (PostGIS's spatial_ref_sys) are left alone: the
# extension owns them, and its reference data is not secret.
OUR_TABLES = """
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
      AND NOT EXISTS (
          SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e'
      )
"""

ENABLE_ROW_LEVEL_SECURITY = f"""
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN {OUR_TABLES} LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END LOOP;
END
$$;
"""

REVOKE_SUPABASE_API_ROLES = """
DO $$
DECLARE
    api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
                api_role);
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
                api_role);
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',
                api_role);
        END IF;
    END LOOP;
END
$$;
"""

DISABLE_ROW_LEVEL_SECURITY = f"""
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN {OUR_TABLES} LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_name);
    END LOOP;
END
$$;
"""


def upgrade() -> None:
    op.execute(ENABLE_ROW_LEVEL_SECURITY)
    op.execute(REVOKE_SUPABASE_API_ROLES)


def downgrade() -> None:
    # Only step 1 is undone. Privileges are not handed back to anon or
    # authenticated: re-opening the data to the public key is never wanted.
    op.execute(DISABLE_ROW_LEVEL_SECURITY)
