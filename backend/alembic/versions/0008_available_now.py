"""The "Available now" switch.

- New column providers.available_until: the owner's "Available now" switch
  runs until this moment (2, 4 or 8 hours after switching it on). NULL = off.
The SQL matches docs/SCHEMA.md.

Revision ID: 0008
Revises: 0007
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE providers ADD COLUMN available_until TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE providers DROP COLUMN available_until")
