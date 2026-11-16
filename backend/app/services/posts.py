"""Stories and banners: what is "active" right now.

Nothing deletes expired rows; every query here filters them out by time.
  - a story is active while  expires_at > now
  - a banner is active while starts_at <= now < expires_at
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Banner, Story

STORY_LIFETIME = timedelta(hours=24)
MAX_ACTIVE_STORIES = 5


@dataclass
class PostInfo:
    """The active posts of a group of providers, loaded with two queries.

    Used to fill has_active_story, banner_title and active_banner for a whole
    page of providers at once, instead of asking the database per provider.
    """

    story_provider_ids: set[uuid.UUID] = field(default_factory=set)
    banners: dict[uuid.UUID, Banner] = field(default_factory=dict)  # provider id -> banner


def load_post_info(db: Session, provider_ids: list[uuid.UUID], now: datetime) -> PostInfo:
    if not provider_ids:
        return PostInfo()

    with_story = db.scalars(
        select(Story.provider_id)
        .where(Story.provider_id.in_(provider_ids), Story.expires_at > now)
        .distinct()
    )
    banners = db.scalars(
        select(Banner).where(
            Banner.provider_id.in_(provider_ids),
            Banner.starts_at <= now,
            Banner.expires_at > now,
        )
    )
    return PostInfo(
        story_provider_ids=set(with_story),
        banners={banner.provider_id: banner for banner in banners},
    )


def count_active_stories(db: Session, provider_id: uuid.UUID, now: datetime) -> int:
    query = (
        select(func.count())
        .select_from(Story)
        .where(Story.provider_id == provider_id, Story.expires_at > now)
    )
    return db.scalar(query) or 0


def active_stories(db: Session, provider_ids: list[uuid.UUID], now: datetime) -> list[Story]:
    """Active stories of these providers, newest first."""
    if not provider_ids:
        return []
    query = (
        select(Story)
        .where(Story.provider_id.in_(provider_ids), Story.expires_at > now)
        .order_by(Story.created_at.desc(), Story.id)
    )
    return list(db.scalars(query))
