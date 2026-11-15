"""Unverified listings, listings published from a suggestion, reports.

- providers.status gains 'unverified' (listed publicly without the badge).
- providers.owner_user_id may be NULL (a listing nobody has claimed).
- providers.source says who created the listing.
- provider_suggestions gains an optional position (lat, lng).
- New table provider_reports.
The SQL matches docs/SCHEMA.md.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A CHECK rule cannot be edited, only dropped and added again.
    # Existing rows keep their status: 'pending' stays 'pending'.
    op.execute("ALTER TABLE providers DROP CONSTRAINT providers_status_check")
    op.execute(
        """
        ALTER TABLE providers ADD CONSTRAINT providers_status_check
            CHECK (status IN ('unverified', 'pending', 'verified', 'rejected'))
        """
    )
    op.execute("ALTER TABLE providers ALTER COLUMN status SET DEFAULT 'unverified'")

    # UNIQUE stays: Postgres allows many NULLs in a UNIQUE column, so it still
    # means "one profile per user" for the rows that have an owner.
    op.execute("ALTER TABLE providers ALTER COLUMN owner_user_id DROP NOT NULL")

    # Existing rows get 'owner': they were all created by their provider.
    op.execute(
        """
        ALTER TABLE providers ADD COLUMN source TEXT NOT NULL DEFAULT 'owner'
            CONSTRAINT providers_source_check CHECK (source IN ('owner', 'suggestion'))
        """
    )

    op.execute(
        """
        ALTER TABLE provider_suggestions
            ADD COLUMN lat DOUBLE PRECISION
                CONSTRAINT provider_suggestions_lat_check CHECK (lat BETWEEN -90 AND 90),
            ADD COLUMN lng DOUBLE PRECISION
                CONSTRAINT provider_suggestions_lng_check CHECK (lng BETWEEN -180 AND 180),
            ADD CONSTRAINT provider_suggestions_lat_lng_together
                CHECK ((lat IS NULL) = (lng IS NULL))
        """
    )

    # No user id and no IP address on purpose: reports are anonymous.
    op.execute(
        """
        CREATE TABLE provider_reports (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            reason       TEXT NOT NULL CHECK (
                             reason IN ('wrong_info', 'not_real', 'closed', 'offensive', 'other')
                         ),
            note         TEXT CHECK (char_length(note) <= 500),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX provider_reports_provider_idx ON provider_reports (provider_id)")


def downgrade() -> None:
    op.execute("DROP TABLE provider_reports")

    op.execute(
        """
        ALTER TABLE provider_suggestions
            DROP CONSTRAINT provider_suggestions_lat_lng_together,
            DROP COLUMN lng,
            DROP COLUMN lat
        """
    )

    op.execute("ALTER TABLE providers DROP COLUMN source")

    # The old schema needs an owner on every row. Unclaimed listings are kept
    # (not deleted) and get a random owner id that belongs to no real user.
    op.execute("UPDATE providers SET owner_user_id = gen_random_uuid() WHERE owner_user_id IS NULL")
    op.execute("ALTER TABLE providers ALTER COLUMN owner_user_id SET NOT NULL")

    # Under the old rules 'pending' was the hidden, waiting state, which is
    # the safest place for profiles that were never verified.
    op.execute("UPDATE providers SET status = 'pending' WHERE status = 'unverified'")
    op.execute("ALTER TABLE providers DROP CONSTRAINT providers_status_check")
    op.execute(
        """
        ALTER TABLE providers ADD CONSTRAINT providers_status_check
            CHECK (status IN ('pending', 'verified', 'rejected'))
        """
    )
    op.execute("ALTER TABLE providers ALTER COLUMN status SET DEFAULT 'pending'")
