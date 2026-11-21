"""What the assistant costs, and the spending caps on it.

- Monthly budget: the sum of cost_usd in assist_log for the current
  calendar month (UTC). At or over ASSIST_MONTHLY_BUDGET_USD the AI is not
  asked any more until the next month.
- Daily budget: the same sum since midnight in Lebanon. At or over
  ASSIST_DAILY_BUDGET_USD the AI rests until tomorrow, so one bad day (a
  burst of abuse, a bug that loops) cannot use up the whole month.

Both are checked before each AI request, so several requests at the same
moment can go slightly over a cap: by a few requests' cost (cents), never more.
The per-person and per-IP daily allowances are in quota.py.
"""

from datetime import UTC, datetime, time
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AssistLog
from app.services.assist import quota
from app.services.assist.ai_client import Usage, model_info
from app.services.opening_hours import BEIRUT


def cost_usd(model: str, usage: Usage) -> Decimal:
    """Dollars for one request: tokens times the model's price per million."""
    prices = model_info(model)
    dollars = (
        usage.input_tokens * prices.input_usd
        + usage.output_tokens * prices.output_usd
        + usage.cache_read_tokens * prices.cache_read_usd
        + usage.cache_write_tokens * prices.cache_write_usd
    ) / 1_000_000
    # assist_log.cost_usd keeps 6 decimals.
    return Decimal(str(round(dollars, 6)))


def month_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def spend_since_usd(db: Session, start: datetime) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(AssistLog.cost_usd), 0)).where(AssistLog.created_at >= start)
    )
    return Decimal(total)


def month_spend_usd(db: Session) -> Decimal:
    return spend_since_usd(db, month_start())


def monthly_budget_reached(db: Session) -> bool:
    return month_spend_usd(db) >= Decimal(str(settings.assist_monthly_budget_usd))


def daily_budget_reached(db: Session) -> bool:
    lebanon_midnight = datetime.combine(quota.today(), time.min, tzinfo=BEIRUT)
    spent_today = spend_since_usd(db, lebanon_midnight)
    return spent_today >= Decimal(str(settings.assist_daily_budget_usd))
