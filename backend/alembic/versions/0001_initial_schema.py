"""Initial schema: categories, providers, reviews, contact_events.

The SQL below is copied from docs/SCHEMA.md, which is the source of truth.
It is written as plain SQL (instead of Alembic's Python helpers) so the two
can be compared line by line.

Revision ID: 0001
Revises:
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.execute(
        """
        CREATE TABLE categories (
            id          SERIAL PRIMARY KEY,
            slug        TEXT NOT NULL UNIQUE,
            name_en     TEXT NOT NULL,
            name_ar     TEXT NOT NULL,
            icon        TEXT NOT NULL,
            parent_id   INTEGER REFERENCES categories(id),
            sort_order  INTEGER NOT NULL DEFAULT 0
        )
        """
    )

    op.execute(
        """
        CREATE TABLE providers (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_user_id         UUID NOT NULL UNIQUE,
            slug                  TEXT NOT NULL UNIQUE,
            name                  TEXT NOT NULL,
            category_id           INTEGER NOT NULL REFERENCES categories(id),
            description           TEXT NOT NULL DEFAULT '',
            price_text            TEXT,
            phone                 TEXT NOT NULL,
            whatsapp              TEXT,
            location              GEOGRAPHY(Point, 4326) NOT NULL,
            area_name             TEXT NOT NULL,
            photos                TEXT[] NOT NULL DEFAULT '{}',
            verification_doc_url  TEXT,
            status                TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'verified', 'rejected')),
            founding_member       BOOLEAN NOT NULL DEFAULT FALSE,
            featured_until        DATE,
            avg_rating            NUMERIC(3,2) NOT NULL DEFAULT 0,
            review_count          INTEGER NOT NULL DEFAULT 0,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    # GIST is the index type that makes "everything within X metres" fast.
    op.execute("CREATE INDEX providers_location_idx ON providers USING GIST (location)")
    op.execute("CREATE INDEX providers_category_status_idx ON providers (category_id, status)")

    op.execute(
        """
        CREATE TABLE reviews (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            user_id      UUID NOT NULL,
            author_name  TEXT NOT NULL,
            rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment      TEXT NOT NULL DEFAULT '',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (provider_id, user_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE contact_events (
            id           BIGSERIAL PRIMARY KEY,
            provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            type         TEXT NOT NULL CHECK (type IN ('view', 'whatsapp', 'call')),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX contact_events_provider_time_idx ON contact_events (provider_id, created_at)"
    )


def downgrade() -> None:
    # The postgis extension is left installed: other things may use it.
    op.execute("DROP TABLE contact_events")
    op.execute("DROP TABLE reviews")
    op.execute("DROP TABLE providers")
    op.execute("DROP TABLE categories")
