"""Category aliases and fuzzy category matching for text search.

- New column categories.aliases: extra search words for a category, such as
  Lebanese Arabic spellings ("سمكري" for a plumber), Arabizi ("sankari") and
  English synonyms ("plumbing"). Filled by 0017.
- Trigram indexes on normalize_name(name_en) and normalize_name(name_ar),
  so similarity() ("plumbr" ~ "Plumber") can use an index. The table is
  small today (about 150 rows), so this is cheap insurance, like the one on
  places (0006).

No new table and no new function, so nothing to add for Row Level Security
(0012) or the fixed search path (0013).

Revision ID: 0016
Revises: 0015
"""

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE categories ADD COLUMN aliases TEXT[] NOT NULL DEFAULT '{}'")
    # gin_trgm_ops comes from pg_trgm (installed by 0006). It is written
    # without a schema, like in 0006, so it is found both locally (public)
    # and on Supabase (the extensions schema is on the search path).
    op.execute(
        "CREATE INDEX categories_name_en_trgm_idx ON categories "
        "USING GIN (normalize_name(name_en) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX categories_name_ar_trgm_idx ON categories "
        "USING GIN (normalize_name(name_ar) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS categories_name_ar_trgm_idx")
    op.execute("DROP INDEX IF EXISTS categories_name_en_trgm_idx")
    op.execute("ALTER TABLE categories DROP COLUMN aliases")
