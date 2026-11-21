"""Give our SQL functions a fixed search path.

A function that looks names up through the caller's search path can be
tricked: whoever calls it could put their own `lower()` earlier in the path.
Supabase's Security Advisor flags this ("Function Search Path Mutable").
normalize_name() only uses built-in functions (pg_catalog is always searched
first), so an empty search path is enough.

Every later migration that creates a function must give it
`SET search_path = ''` too; tests/test_db_security.py fails otherwise.

Revision ID: 0013
Revises: 0012
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER FUNCTION normalize_name(TEXT) SET search_path = ''")


def downgrade() -> None:
    op.execute("ALTER FUNCTION normalize_name(TEXT) RESET search_path")
