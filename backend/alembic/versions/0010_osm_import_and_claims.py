"""OpenStreetMap import and "Claim this business".

- providers.source may be 'osm'; providers.osm_ref keeps the OSM id
  ('node/123') so the import can be run again without duplicates.
- providers.phone may be NULL, but only for 'osm' rows (many OSM places
  have no phone number).
- provider_reports.reason gets 'remove_my_business'.
- New table claims.

Revision ID: 0010
Revises: 0009
"""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A CHECK rule cannot be edited, only dropped and added again.
    op.execute("ALTER TABLE providers DROP CONSTRAINT providers_source_check")
    op.execute(
        """
        ALTER TABLE providers ADD CONSTRAINT providers_source_check
            CHECK (source IN ('owner', 'suggestion', 'osm'))
        """
    )
    op.execute("ALTER TABLE providers ADD COLUMN osm_ref TEXT UNIQUE")
    op.execute("ALTER TABLE providers ALTER COLUMN phone DROP NOT NULL")
    op.execute(
        """
        ALTER TABLE providers ADD CONSTRAINT providers_phone_required
            CHECK (phone IS NOT NULL OR source = 'osm')
        """
    )

    op.execute("ALTER TABLE provider_reports DROP CONSTRAINT provider_reports_reason_check")
    op.execute(
        """
        ALTER TABLE provider_reports ADD CONSTRAINT provider_reports_reason_check
            CHECK (reason IN ('wrong_info', 'not_real', 'closed', 'offensive',
                              'remove_my_business', 'other'))
        """
    )

    op.execute(
        """
        CREATE TABLE claims (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id           UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            user_id               UUID NOT NULL,
            message               TEXT CHECK (char_length(message) <= 500),
            verification_doc_url  TEXT,
            status                TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'rejected')),
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            decided_at            TIMESTAMPTZ
        )
        """
    )
    # A partial unique index: only rows with status 'pending' take part, so a
    # user can claim again after a rejection, but never have two open claims.
    op.execute(
        "CREATE UNIQUE INDEX claims_one_pending_idx ON claims (provider_id, user_id) "
        "WHERE status = 'pending'"
    )
    op.execute("CREATE INDEX claims_status_created_idx ON claims (status, created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE claims")
    op.execute("DELETE FROM provider_reports WHERE reason = 'remove_my_business'")
    op.execute("ALTER TABLE provider_reports DROP CONSTRAINT provider_reports_reason_check")
    op.execute(
        """
        ALTER TABLE provider_reports ADD CONSTRAINT provider_reports_reason_check
            CHECK (reason IN ('wrong_info', 'not_real', 'closed', 'offensive', 'other'))
        """
    )
    # Imported listings cannot exist without the new columns and rules.
    op.execute("DELETE FROM providers WHERE source = 'osm'")
    op.execute("ALTER TABLE providers DROP CONSTRAINT providers_phone_required")
    op.execute("ALTER TABLE providers ALTER COLUMN phone SET NOT NULL")
    op.execute("ALTER TABLE providers DROP COLUMN osm_ref")
    op.execute("ALTER TABLE providers DROP CONSTRAINT providers_source_check")
    op.execute(
        """
        ALTER TABLE providers ADD CONSTRAINT providers_source_check
            CHECK (source IN ('owner', 'suggestion'))
        """
    )
