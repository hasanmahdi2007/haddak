"""Counting contact events (views, WhatsApp taps, call taps) per month."""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ContactEvent, Provider


def current_month_start() -> datetime:
    """Midnight (UTC) on the 1st of the current month. "This month" in the
    owner's stats and in the public contact count both start here."""
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def public_contact_count(db: Session, provider: Provider) -> int | None:
    """WhatsApp + call taps this month, or None if the provider hides it.

    Views are left out on purpose: the number should mean "people who
    contacted this provider", not "people who looked".
    """
    if not provider.show_contact_count:
        return None
    count = db.scalar(
        select(func.count())
        .select_from(ContactEvent)
        .where(
            ContactEvent.provider_id == provider.id,
            ContactEvent.type.in_(["whatsapp", "call"]),
            ContactEvent.created_at >= current_month_start(),
        )
    )
    return count or 0
