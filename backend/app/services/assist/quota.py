"""The free daily allowance of AI requests (docs/AI_ASSISTANT.md, "Limits").

Only requests that are about to reach the AI are counted: exact names,
remembered sentences and tapped options are free. Over the allowance nobody
is blocked; the free keyword search answers instead.

Who is counted, for one request:
- the person: the signed-in account, or else the phone (the random install id
  the app sends in the X-Haddak-Device header). An account gets more, because
  making accounts costs an email address each, while an install id costs
  nothing to invent.
- the IP address, always, with a higher allowance shared by everyone on it.
  Many phones on Alfa and Touch share one public address, so it cannot be
  low. It is what stops a script that invents a new install id per request.
A request without an account or a valid install id is counted on the IP only.

Counts live in the database (table assist_quota), not in memory, so they
survive restarts and redeploys, and would be shared by several servers.

Privacy: the table never holds an account id, install id or IP address, only
HMAC-SHA256(ASSIST_QUOTA_SECRET, day + who). Without the secret it cannot be
turned back into an IP (a plain hash could: there are only about 4 billion
IPv4 addresses to try), and because the day is part of it, today's row for a
phone cannot be linked to yesterday's.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AssistQuota
from app.services.opening_hours import BEIRUT

# Rows are kept a little longer than one day, in case a day is ever checked late.
KEEP_DAYS = 2
# Only used when ASSIST_QUOTA_SECRET is empty, which production refuses (config.py).
DEVELOPMENT_SECRET = "development-only-assist-quota-secret"


def today() -> date:
    """The current day in Lebanon: allowances start again at local midnight.
    A function so tests can move to "tomorrow"."""
    return datetime.now(BEIRUT).date()


def parse_device_id(value: str | None) -> str | None:
    """The install id from the X-Haddak-Device header, or None if it is
    missing or not a UUID (anything else is ignored, not trusted)."""
    if not value:
        return None
    try:
        return str(uuid.UUID(value.strip()))
    except ValueError:
        return None


@dataclass(frozen=True)
class Caller:
    """Who is asking, as far as the API can tell."""

    ip: str
    user_id: uuid.UUID | None = None
    device_id: str | None = None

    def allowances(self) -> list[tuple[str, int]]:
        """(who, daily allowance) pairs this request counts against.
        Always in the same order, person first then IP; see take_ai_allowance."""
        counted = []
        if self.user_id is not None:
            counted.append((f"user:{self.user_id}", settings.assist_daily_limit_signed_in))
        elif self.device_id is not None:
            counted.append((f"device:{self.device_id}", settings.assist_daily_limit_anonymous))
        counted.append((f"ip:{self.ip}", settings.assist_daily_limit_per_ip))
        return counted


def subject_hash(who: str, day: date) -> str:
    secret = settings.assist_quota_secret.strip() or DEVELOPMENT_SECRET
    message = f"{day.isoformat()}|{who}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def take_ai_allowance(db: Session, caller: Caller) -> bool:
    """Count one AI request for everyone in caller.allowances().

    True if each of them was still under its allowance. Otherwise nothing is
    counted at all (the transaction is rolled back) and the answer is False,
    so a refused request never uses up anybody's allowance.

    Each count is one atomic "insert or add 1" that returns the new total, so
    two requests at the same moment cannot both take the last one: the
    second waits for the first's row lock. Rows are always locked in the same
    order (person, then IP), so two requests can never wait for each other.
    The transaction ends here (commit or rollback), before the slow AI call,
    so no lock is held while waiting for the AI.
    """
    day = today()
    try:
        for who, allowance in caller.allowances():
            statement = (
                insert(AssistQuota)
                .values(subject=subject_hash(who, day), day=day, used=1)
                .on_conflict_do_update(
                    index_elements=[AssistQuota.subject, AssistQuota.day],
                    set_={"used": AssistQuota.used + 1},
                )
                .returning(AssistQuota.used)
            )
            if db.scalar(statement) > allowance:
                db.rollback()
                return False
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def forget_old_days(db: Session) -> None:
    """Delete rows older than KEEP_DAYS. Cheap (indexed by day), so it simply
    runs whenever the allowance is checked."""
    db.execute(delete(AssistQuota).where(AssistQuota.day < today() - timedelta(days=KEEP_DAYS)))
    db.commit()
