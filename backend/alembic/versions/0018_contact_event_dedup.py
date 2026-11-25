"""Contact events: "same tap twice" rule in the database, honest public count.

Before, the rule "the same person sending the same event for the same
provider within 10 minutes counts once" lived in the server's memory: it was
forgotten at every restart and would double with two servers. It now lives
in `contact_event_dedup`, one short-lived row per (who, provider, event)
key. `who` is the user id when signed in, else the IP address; the key is
stored only as a keyed hash (HMAC), and rows are deleted when they expire
(after 10 minutes, or 2 days for the public-count keys).

The public "contacts this month" number now counts only taps marked
`counts_publicly`: WhatsApp or call taps by a signed-in user, once per user
per provider per day (UTC). Anonymous taps still count in the owner's
private stats. Taps stored before this migration keep counting publicly, so
no profile's number drops in the middle of a month.

Revision ID: 0018
Revises: 0017
"""

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE contact_event_dedup (
            key_hash    TEXT PRIMARY KEY,
            expires_at  TIMESTAMPTZ NOT NULL
        )
        """
    )
    # Expired rows are deleted a few at a time on each new event.
    op.execute("CREATE INDEX contact_event_dedup_expires_idx ON contact_event_dedup (expires_at)")
    # Closed to Supabase's Data API like every other table (see 0012).
    op.execute("ALTER TABLE contact_event_dedup ENABLE ROW LEVEL SECURITY")

    # NOT NULL with a default: old code that does not know the column keeps working.
    op.execute(
        "ALTER TABLE contact_events ADD COLUMN counts_publicly BOOLEAN NOT NULL DEFAULT false"
    )
    op.execute(
        "UPDATE contact_events SET counts_publicly = true WHERE type IN ('whatsapp', 'call')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE contact_events DROP COLUMN counts_publicly")
    op.execute("DROP TABLE contact_event_dedup")
