"""Contact events (views, WhatsApp taps, call taps): storing and counting them.

Two rules keep the numbers honest (docs/API.md, "contact-events"):

1. The same caller sending the same event for the same provider within
   10 minutes is stored once. "Caller" is the user id when signed in, else
   the IP address (so two signed-in people behind one carrier address are
   two people).
2. The public "contacts this month" number counts only signed-in WhatsApp or
   call taps, at most one per user per provider per day. Anyone can send
   anonymous taps from a script, so those count only in the owner's private
   stats.

Both rules are kept in the `contact_event_dedup` table, not in the server's
memory, so they survive restarts and would hold with several servers. A row
there is just a keyed hash of "who, provider, event" and an expiry time.
"""

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ContactEvent, Provider

REPEAT_WINDOW = timedelta(minutes=10)
# The public key is per UTC day; kept two days so a key from just before
# midnight is still there when its day is compared.
PUBLIC_KEY_LIFETIME = timedelta(days=2)
CONTACT_TYPES = ("whatsapp", "call")
# Expired dedup rows deleted per new event: enough to keep the table small.
PURGE_BATCH = 100


def utc_now() -> datetime:
    """This moment. A separate function so tests can move time forward."""
    return datetime.now(UTC)


def current_month_start() -> datetime:
    """Midnight (UTC) on the 1st of the current month. "This month" in the
    owner's stats and in the public contact count both start here."""
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def key_hash(key: str) -> str:
    """A keyed hash of `key`, so the table holds no user ids or IP addresses.

    Keyed with ASSIST_QUOTA_SECRET (the same "hash who it was" secret the
    assistant allowance uses): without the secret, an IPv4 address could be
    found again by trying all 4 billion of them.
    """
    secret = settings.assist_quota_secret.encode()
    return hmac.new(secret, key.encode(), hashlib.sha256).hexdigest()


def claim_key(db: Session, key: str, lifetime: timedelta, now: datetime) -> bool:
    """True the first time `key` is seen within `lifetime`, False for a repeat.

    One statement does it, so two identical requests at the same moment
    cannot both get True:
      - a new key is inserted;
      - an existing but expired key is renewed (also counts as new);
      - an existing, still valid key changes nothing and returns no row.
    """
    row = db.execute(
        text(
            """
            INSERT INTO contact_event_dedup (key_hash, expires_at)
            VALUES (:key_hash, :expires_at)
            ON CONFLICT (key_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at
                WHERE contact_event_dedup.expires_at <= :now
            RETURNING key_hash
            """
        ),
        {"key_hash": key_hash(key), "expires_at": now + lifetime, "now": now},
    ).first()
    return row is not None


def purge_expired_keys(db: Session, now: datetime) -> None:
    db.execute(
        text(
            """
            DELETE FROM contact_event_dedup WHERE key_hash IN (
                SELECT key_hash FROM contact_event_dedup
                WHERE expires_at <= :now
                LIMIT :batch
            )
            """
        ),
        {"now": now, "batch": PURGE_BATCH},
    )


def record_contact_event(
    db: Session,
    provider_id: uuid.UUID,
    event_type: str,
    user_id: uuid.UUID | None,
    client_ip: str,
) -> bool:
    """Store one contact event unless it is a repeat (rule 1 above).

    Returns whether it was stored. The caller commits.
    """
    now = utc_now()
    purge_expired_keys(db, now)

    caller = f"user:{user_id}" if user_id is not None else f"ip:{client_ip}"
    if not claim_key(db, f"repeat:{caller}:{provider_id}:{event_type}", REPEAT_WINDOW, now):
        return False

    counts_publicly = False
    if user_id is not None and event_type in CONTACT_TYPES:
        public_key = f"public:{user_id}:{provider_id}:{now.date().isoformat()}"
        counts_publicly = claim_key(db, public_key, PUBLIC_KEY_LIFETIME, now)

    db.add(ContactEvent(provider_id=provider_id, type=event_type, counts_publicly=counts_publicly))
    return True


def public_contact_count(db: Session, provider: Provider) -> int | None:
    """Signed-in WhatsApp + call taps this month (rule 2 above), or None if
    the provider hides the number.

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
            ContactEvent.type.in_(CONTACT_TYPES),
            ContactEvent.counts_publicly.is_(True),
            ContactEvent.created_at >= current_month_start(),
        )
    )
    return count or 0


def public_contact_counts(db: Session, provider_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """The same public number for many providers in one query (the admin
    list). Pass only providers that show the number. Providers with no
    counted taps are missing from the dict."""
    if not provider_ids:
        return {}
    rows = db.execute(
        select(ContactEvent.provider_id, func.count())
        .where(
            ContactEvent.provider_id.in_(provider_ids),
            ContactEvent.type.in_(CONTACT_TYPES),
            ContactEvent.counts_publicly.is_(True),
            ContactEvent.created_at >= current_month_start(),
        )
        .group_by(ContactEvent.provider_id)
    )
    return {provider_id: count for provider_id, count in rows}
