"""Hire checks ("Did you hire them?").

- New table hire_checks: one row when a signed-in user taps WhatsApp or Call
  on a profile. The app later asks the user whether they hired the provider,
  and the answer is stored on the same row.
The SQL matches docs/SCHEMA.md.

Revision ID: 0007
Revises: 0006
"""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # answer and answered_at are both NULL (not answered yet) or both set.
    op.execute(
        """
        CREATE TABLE hire_checks (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id   UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            user_id       UUID NOT NULL,
            contact_type  TEXT NOT NULL CHECK (contact_type IN ('whatsapp', 'call')),
            contacted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            answer        TEXT CHECK (answer IN ('hired', 'not_yet', 'no_answer')),
            answered_at   TIMESTAMPTZ,
            CONSTRAINT hire_checks_answer_time_together
                CHECK ((answer IS NULL) = (answered_at IS NULL))
        )
        """
    )
    # "My pending checks" and the 7-day rule look up by user and time.
    op.execute("CREATE INDEX hire_checks_user_contacted_idx ON hire_checks (user_id, contacted_at)")
    # confirmed_hires and the admin's no_answer count look up by provider and answer.
    op.execute(
        "CREATE INDEX hire_checks_provider_answer_idx "
        "ON hire_checks (provider_id, answer, answered_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE hire_checks")
