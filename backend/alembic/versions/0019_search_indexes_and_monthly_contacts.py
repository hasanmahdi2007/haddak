"""Indexes for text search and the stories feed; monthly contact totals.

1. Trigram indexes on normalize_name(providers.name) and
   normalize_name(providers.area_name). The search box (q) looks for
   "normalize_name(name) LIKE '%text%'"; without these, every provider inside
   the circle is normalised and scanned. 0016 added the same kind of index
   to categories only.
2. An index on stories(expires_at). The nearby-stories feed asks for
   "expires_at > now" over all providers; the existing index starts with
   provider_id, so it cannot help there.
3. Table contact_event_months: one row per provider, month and event type
   with the count. scripts/retention.py moves old contact_events rows into
   it (then deletes them), so the history stays while the big table stops
   growing forever. See docs/SCHEMA.md, "Retention".

The indexes are built with CREATE INDEX CONCURRENTLY: providers and stories
keep serving searches while it runs. CONCURRENTLY cannot run inside a
transaction, hence autocommit_block(). If a concurrent build fails half way
it leaves an unusable ("invalid") index behind, so each one is dropped first:
this code only runs while the migration is not yet recorded as done, so an
index with that name can only be such a leftover.

Revision ID: 0019
Revises: 0018
"""

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None

# gin_trgm_ops comes from pg_trgm (0006); written without a schema like in
# 0006 and 0016, so it is found locally (public) and on Supabase (extensions).
INDEXES = {
    "providers_name_trgm_idx": "providers USING GIN (normalize_name(name) gin_trgm_ops)",
    "providers_area_name_trgm_idx": "providers USING GIN (normalize_name(area_name) gin_trgm_ops)",
    "stories_expires_idx": "stories (expires_at)",
}


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE contact_event_months (
            provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            month        DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
            type         TEXT NOT NULL CHECK (type IN ('view', 'whatsapp', 'call')),
            count        INTEGER NOT NULL CHECK (count >= 0),
            PRIMARY KEY (provider_id, month, type)
        )
        """
    )
    # Closed to Supabase's Data API like every other table (see 0012).
    op.execute("ALTER TABLE contact_event_months ENABLE ROW LEVEL SECURITY")

    with op.get_context().autocommit_block():
        # A concurrent build waits for older transactions to finish (for
        # example a running backup) and blocks nobody while it waits, so
        # the migration's 5 s lock_timeout (alembic/env.py) is lifted here
        # and put back afterwards.
        previous_lock_timeout = op.get_bind().exec_driver_sql("SHOW lock_timeout").scalar()
        op.execute("SET lock_timeout = 0")
        for name, target in INDEXES.items():
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
            op.execute(f"CREATE INDEX CONCURRENTLY {name} ON {target}")
        op.execute(f"SET lock_timeout = '{previous_lock_timeout}'")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name in INDEXES:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
    op.execute("DROP TABLE contact_event_months")
