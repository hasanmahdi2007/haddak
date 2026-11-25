"""Delete or summarise old rows, so the database stops growing forever.

    python scripts/retention.py            # dry run: prints what it WOULD do
    python scripts/retention.py --apply    # does it, in one transaction

Run it against production about once a month, from the backend folder with
DATABASE_URL set to the production value (docs/DEPLOY.md, "Keeping the
database small"). It is safe to run again: a second run finds nothing old.

What it does (the rules are in docs/SCHEMA.md, "Retention"):
  - stories that expired more than STORY_DAYS days ago: deleted (nothing
    shows them any more; the feed only shows stories that have not expired);
  - assist_log rows older than ASSIST_LOG_DAYS days: deleted (the cost caps
    only look at the current month; the "most wanted" list at recent rows);
  - contact_events (views and taps) from months before the last
    CONTACT_MONTHS_KEPT full months: added up into contact_event_months
    (one row per provider, month and type), then deleted. The owner's stats
    and the public count only read the current month, so nothing on screen
    changes; the history is kept as totals.
"""

import argparse
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

# Allow `python scripts/retention.py` to import the `app` package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal  # noqa: E402

STORY_DAYS = 30
ASSIST_LOG_DAYS = 180
# Raw contact events are kept for the current month plus this many full
# months before it; older ones become monthly totals.
CONTACT_MONTHS_KEPT = 3

# The API allows 8 s per statement; a first clean-up of a big table may
# need longer. SET LOCAL: only for this script's transaction.
SCRIPT_STATEMENT_TIMEOUT = "5min"


@dataclass
class RetentionReport:
    stories_deleted: int
    assist_log_deleted: int
    contact_events_rolled_up: int
    contact_event_months_written: int
    contact_cutoff: date


def contact_cutoff_month(now: datetime) -> date:
    """The first day of the oldest month whose raw events are kept (UTC)."""
    year, month = now.year, now.month - CONTACT_MONTHS_KEPT
    while month < 1:
        month += 12
        year -= 1
    return date(year, month, 1)


def run_retention(db: Session, now: datetime, *, apply: bool) -> RetentionReport:
    """Does the work in the caller's transaction. Commits only when apply is
    True; a dry run rolls everything back, so the counts are exact and
    nothing changes."""
    db.execute(text(f"SET LOCAL statement_timeout = '{SCRIPT_STATEMENT_TIMEOUT}'"))
    story_cutoff = now - timedelta(days=STORY_DAYS)
    log_cutoff = now - timedelta(days=ASSIST_LOG_DAYS)
    contact_cutoff = contact_cutoff_month(now)
    contact_cutoff_time = datetime(contact_cutoff.year, contact_cutoff.month, 1, tzinfo=UTC)

    stories = db.execute(
        text("DELETE FROM stories WHERE expires_at < :cutoff"), {"cutoff": story_cutoff}
    ).rowcount
    logs = db.execute(
        text("DELETE FROM assist_log WHERE created_at < :cutoff"), {"cutoff": log_cutoff}
    ).rowcount

    # Add the old events to the monthly totals (adding to a total that an
    # earlier run already wrote for the same month), then delete them. Both
    # in the same transaction: either both happen or neither.
    months_written = db.execute(
        text(
            """
            INSERT INTO contact_event_months (provider_id, month, type, count)
            SELECT provider_id,
                   date_trunc('month', created_at AT TIME ZONE 'UTC')::date,
                   type,
                   count(*)
            FROM contact_events
            WHERE created_at < :cutoff
            GROUP BY 1, 2, 3
            ON CONFLICT (provider_id, month, type)
            DO UPDATE SET count = contact_event_months.count + EXCLUDED.count
            """
        ),
        {"cutoff": contact_cutoff_time},
    ).rowcount
    rolled_up = db.execute(
        text("DELETE FROM contact_events WHERE created_at < :cutoff"),
        {"cutoff": contact_cutoff_time},
    ).rowcount

    if apply:
        db.commit()
    else:
        db.rollback()
    return RetentionReport(
        stories_deleted=stories,
        assist_log_deleted=logs,
        contact_events_rolled_up=rolled_up,
        contact_event_months_written=months_written,
        contact_cutoff=contact_cutoff,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete or summarise old rows.")
    parser.add_argument(
        "--apply", action="store_true", help="really change the database (default: dry run)"
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        report = run_retention(db, datetime.now(UTC), apply=args.apply)

    mode = "Done" if args.apply else "Dry run (nothing changed; add --apply to do it)"
    print(mode)
    print(f"  stories expired > {STORY_DAYS} days ago deleted: {report.stories_deleted}")
    print(f"  assist_log rows > {ASSIST_LOG_DAYS} days old deleted: {report.assist_log_deleted}")
    print(
        f"  contact_events before {report.contact_cutoff} summed into "
        f"{report.contact_event_months_written} monthly rows, then deleted: "
        f"{report.contact_events_rolled_up}"
    )


if __name__ == "__main__":
    main()
