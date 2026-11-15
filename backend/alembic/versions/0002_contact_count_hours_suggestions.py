"""Public contact count, opening hours, provider suggestions.

Adds providers.show_contact_count and providers.opening_hours, and the
provider_suggestions table. The SQL matches docs/SCHEMA.md.

Revision ID: 0002
Revises: 0001
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing rows get FALSE: nobody's count becomes public by surprise.
    op.execute("ALTER TABLE providers ADD COLUMN show_contact_count BOOLEAN NOT NULL DEFAULT FALSE")
    # NULL means "hours not provided". The shape is validated by the API.
    op.execute("ALTER TABLE providers ADD COLUMN opening_hours JSONB")

    # No user id and no IP address on purpose: suggestions are anonymous.
    op.execute(
        """
        CREATE TABLE provider_suggestions (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name         TEXT NOT NULL,
            phone        TEXT,
            category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            area_name    TEXT,
            note         TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE provider_suggestions")
    op.execute("ALTER TABLE providers DROP COLUMN opening_hours")
    op.execute("ALTER TABLE providers DROP COLUMN show_contact_count")
