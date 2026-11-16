"""Remembered AI answers (the assist_cache table).

The same normalised sentence gets the same answer without a second AI
request. Only a hash of the sentence is stored, never the sentence.
Answers older than CACHE_DAYS are asked again, so a changed prompt or
category list is picked up eventually.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import AssistCache
from app.services.assist.ai_client import AIResult

CACHE_DAYS = 30


def get_cached(db: Session, text_hash: str) -> AIResult | None:
    row = db.get(AssistCache, text_hash)
    if row is None or row.created_at < datetime.now(UTC) - timedelta(days=CACHE_DAYS):
        return None
    try:
        return AIResult.model_validate(row.result)
    except ValueError:
        # Stored by an older version with a different shape: ask again.
        return None


def save_cached(db: Session, text_hash: str, result: AIResult, model: str) -> None:
    """Insert or overwrite (two identical sentences can arrive at once)."""
    values = {
        "text_hash": text_hash,
        "result": result.model_dump(mode="json"),
        "model": model,
        "created_at": datetime.now(UTC),
    }
    statement = insert(AssistCache).values(**values)
    statement = statement.on_conflict_do_update(index_elements=["text_hash"], set_=values)
    db.execute(statement)
