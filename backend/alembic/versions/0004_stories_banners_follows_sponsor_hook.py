"""Stories, banners, follows and the sponsor hook.

- providers gains sponsor_hook (a one-sentence pitch, shown while sponsored).
- New table stories: short posts that are shown for 24 hours.
- New table banners: one current offer per provider.
- New table follows: which user follows which provider.
The SQL matches docs/SCHEMA.md.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE providers ADD COLUMN sponsor_hook TEXT
            CONSTRAINT providers_sponsor_hook_check CHECK (char_length(sponsor_hook) <= 80)
        """
    )

    # Expired stories stay in the table; queries filter on expires_at.
    op.execute(
        """
        CREATE TABLE stories (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            text         TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
            image_url    TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at   TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX stories_provider_expires_idx ON stories (provider_id, expires_at)")

    # provider_id is the primary key: the database itself guarantees that a
    # provider never has two banners.
    op.execute(
        """
        CREATE TABLE banners (
            provider_id       UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
            title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
            text              TEXT CHECK (char_length(text) <= 200),
            discount_percent  SMALLINT CHECK (discount_percent BETWEEN 1 AND 90),
            starts_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at        TIMESTAMPTZ NOT NULL
        )
        """
    )

    # The two-column primary key means a user can follow a provider only once.
    op.execute(
        """
        CREATE TABLE follows (
            user_id      UUID NOT NULL,
            provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, provider_id)
        )
        """
    )
    op.execute("CREATE INDEX follows_provider_idx ON follows (provider_id)")


def downgrade() -> None:
    op.execute("DROP TABLE follows")
    op.execute("DROP TABLE banners")
    op.execute("DROP TABLE stories")
    op.execute("ALTER TABLE providers DROP COLUMN sponsor_hook")
