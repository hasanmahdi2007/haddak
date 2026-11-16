"""What the assistant costs, and the two limits on it.

- Monthly budget: the sum of cost_usd in assist_log for the current
  calendar month (UTC). At or over ASSIST_MONTHLY_BUDGET_USD the AI is not
  asked any more until the next month.
- Daily limit: ASSIST_DAILY_LIMIT AI requests per IP per 24 hours. Kept in
  the process memory like the other rate limits (app/rate_limit.py). Only
  requests that are really about to reach the AI are counted.
"""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AssistLog
from app.rate_limit import limiter
from app.services.assist.ai_client import Usage, model_info

ONE_DAY = 24 * 60 * 60


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


def month_spend_usd(db: Session) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(AssistLog.cost_usd), 0)).where(
            AssistLog.created_at >= month_start()
        )
    )
    return Decimal(total)


def budget_reached(db: Session) -> bool:
    return month_spend_usd(db) >= Decimal(str(settings.assist_monthly_budget_usd))


def daily_limit_reached(client_ip: str) -> bool:
    """Counts one AI request for this IP. True if the IP already used up its
    allowance in the last 24 hours (then nothing is counted)."""
    key = f"assist:{client_ip}"
    return limiter.seconds_to_wait(key, settings.assist_daily_limit, ONE_DAY) > 0
