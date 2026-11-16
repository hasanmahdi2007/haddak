"""Small queries about who follows a provider."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Follow


def follower_count(db: Session, provider_id: uuid.UUID) -> int:
    query = select(func.count()).select_from(Follow).where(Follow.provider_id == provider_id)
    return db.scalar(query) or 0


def is_following(db: Session, user_id: uuid.UUID | None, provider_id: uuid.UUID) -> bool:
    """False for an anonymous caller (user_id None)."""
    if user_id is None:
        return False
    # db.get looks a row up by its primary key: here the pair (user, provider).
    return db.get(Follow, (user_id, provider_id)) is not None
