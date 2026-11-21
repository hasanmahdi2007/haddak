"""Daily AI allowance for the assistant, kept in the database.

The allowance used to live in the API's memory, so it was forgotten on every
restart or redeploy (and a sleeping free server restarts often). One row per
"who" per day; see app/services/assist/quota.py for what "who" is and why it
is stored only as a keyed hash.

Revision ID: 0011
Revises: 0010
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE assist_quota (
            subject TEXT NOT NULL,
            day DATE NOT NULL,
            used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
            PRIMARY KEY (subject, day)
        )
        """
    )
    # Old days are deleted by day; the primary key cannot help with that.
    op.execute("CREATE INDEX assist_quota_day_idx ON assist_quota (day)")


def downgrade() -> None:
    op.execute("DROP TABLE assist_quota")
