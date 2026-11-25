"""Hire checks ("Did you hire them?"): creating, counting and reading them.

The flow:
  1. A signed-in user taps WhatsApp or Call -> maybe_create_check() adds a row.
  2. 12 hours later the app asks "Did you hire them?" (routers/hire_checks.py).
  3. A 'hired' answer marks the user's review and counts in confirmed_hires.
See docs/API.md, section "Did you hire them?".
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PUBLIC_STATUSES, HireCheck, Provider

# How long one check covers a user and provider: no second question within 7 days.
ONE_CHECK_PER = timedelta(days=7)
# The app asks no sooner than 12 hours after the tap, and gives up after 14 days.
ASK_AFTER = timedelta(hours=12)
ASK_UNTIL = timedelta(days=14)
# confirmed_hires and the admin's no_answer count look back this far.
COUNT_WINDOW = timedelta(days=90)


def now() -> datetime:
    return datetime.now(UTC)


def maybe_create_check(
    db: Session, provider: Provider, user_id: uuid.UUID, contact_type: str
) -> None:
    """Add a hire check for this tap, unless one was made in the last 7 days.

    The caller commits. Taps on your own profile never create a check.
    """
    if provider.owner_user_id == user_id:
        return

    # Lock the provider row so two taps arriving at the same moment take
    # turns: the second one then sees the first one's check and stops.
    db.execute(select(Provider.id).where(Provider.id == provider.id).with_for_update())

    recent = db.scalar(
        select(HireCheck.id).where(
            HireCheck.provider_id == provider.id,
            HireCheck.user_id == user_id,
            HireCheck.contacted_at > now() - ONE_CHECK_PER,
        )
    )
    if recent is None:
        db.add(HireCheck(provider_id=provider.id, user_id=user_id, contact_type=contact_type))


def confirmed_hires(db: Session, provider_id: uuid.UUID) -> int:
    """How many people answered "Yes, I hired them" in the last 90 days."""
    count = db.scalar(
        select(func.count())
        .select_from(HireCheck)
        .where(
            HireCheck.provider_id == provider_id,
            HireCheck.answer == "hired",
            HireCheck.answered_at >= now() - COUNT_WINDOW,
        )
    )
    return count or 0


def confirmed_hires_counts(db: Session, provider_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """confirmed_hires() for many providers in one query. Providers with
    none are missing from the dict."""
    if not provider_ids:
        return {}
    rows = db.execute(
        select(HireCheck.provider_id, func.count())
        .where(
            HireCheck.provider_id.in_(provider_ids),
            HireCheck.answer == "hired",
            HireCheck.answered_at >= now() - COUNT_WINDOW,
        )
        .group_by(HireCheck.provider_id)
    )
    return {provider_id: count for provider_id, count in rows}


def hired_user_ids(
    db: Session, provider_id: uuid.UUID, user_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    """Which of these users said they hired this provider (at any time).

    Used to mark reviews "Hired through Haddak". One query for a whole page
    of reviews. It is worked out when reviews are read, so a review written
    after the answer is marked too.
    """
    if not user_ids:
        return set()
    rows = db.scalars(
        select(HireCheck.user_id).where(
            HireCheck.provider_id == provider_id,
            HireCheck.user_id.in_(user_ids),
            HireCheck.answer == "hired",
        )
    )
    return set(rows)


def no_answer_counts(db: Session, provider_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Count "They didn't answer" replies per provider in the last 90 days.

    Founder only (admin page): providers and the public never see this.
    Providers with no such replies are simply missing from the dict.
    """
    if not provider_ids:
        return {}
    rows = db.execute(
        select(HireCheck.provider_id, func.count())
        .where(
            HireCheck.provider_id.in_(provider_ids),
            HireCheck.answer == "no_answer",
            HireCheck.answered_at >= now() - COUNT_WINDOW,
        )
        .group_by(HireCheck.provider_id)
    )
    return {provider_id: count for provider_id, count in rows}


def pending_checks(db: Session, user_id: uuid.UUID, limit: int = 3) -> list[HireCheck]:
    """My unanswered checks made 12 hours to 14 days ago, newest first.

    Checks on rejected providers are left out: the profile is gone for the
    public, so there is nothing to ask about.
    """
    current = now()
    query = (
        select(HireCheck)
        .join(Provider, Provider.id == HireCheck.provider_id)
        .where(
            HireCheck.user_id == user_id,
            HireCheck.answer.is_(None),
            HireCheck.contacted_at <= current - ASK_AFTER,
            HireCheck.contacted_at > current - ASK_UNTIL,
            Provider.status.in_(PUBLIC_STATUSES),
        )
        .order_by(HireCheck.contacted_at.desc())
        .limit(limit)
    )
    return list(db.scalars(query))
