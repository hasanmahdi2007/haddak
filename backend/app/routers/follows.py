"""Following providers: follow, unfollow, my list, my feed of their stories."""

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models import PUBLIC_STATUSES, Follow, Provider
from app.rate_limit import limit_writes
from app.routers.providers import MAX_OFFSET, get_public_provider
from app.schemas import ProviderSearchResult, StoryGroupList
from app.services.provider_views import to_summaries
from app.services.story_feed import load_story_groups

router = APIRouter(tags=["follows"])


@router.put(
    "/providers/{provider_id}/follow", status_code=204, dependencies=[Depends(limit_writes)]
)
def follow_provider(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    provider = get_public_provider(db, provider_id)  # 404 if unknown or rejected

    # "INSERT ... ON CONFLICT DO NOTHING": if I already follow this provider
    # the database quietly skips the insert, so following twice is not an
    # error, even when both requests arrive at the same moment.
    db.execute(
        insert(Follow).values(user_id=user_id, provider_id=provider.id).on_conflict_do_nothing()
    )
    db.commit()
    return Response(status_code=204)


@router.delete(
    "/providers/{provider_id}/follow", status_code=204, dependencies=[Depends(limit_writes)]
)
def unfollow_provider(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    provider = get_public_provider(db, provider_id)

    follow = db.get(Follow, (user_id, provider.id))
    if follow is not None:
        db.delete(follow)
        db.commit()
    # 204 also when I was not following: the result is the same.
    return Response(status_code=204)


@router.get("/me/following", response_model=ProviderSearchResult)
def list_following(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_OFFSET),
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Providers I follow, most recently followed first. Rejected ones are left out."""
    filters = [Follow.user_id == user_id, Provider.status.in_(PUBLIC_STATUSES)]

    query = (
        select(Provider)
        .join(Follow, Follow.provider_id == Provider.id)
        .where(*filters)
        .order_by(Follow.created_at.desc(), Provider.id)
        .limit(limit)
        .offset(offset)
    )
    # to_summaries wants (provider, distance) pairs; there is no distance here.
    rows = [(provider, None) for provider in db.scalars(query)]

    total = db.scalar(
        select(func.count())
        .select_from(Follow)
        .join(Provider, Provider.id == Follow.provider_id)
        .where(*filters)
    )
    return ProviderSearchResult(items=to_summaries(db, rows), total=total or 0)


@router.get("/me/feed", response_model=StoryGroupList)
def my_feed(db: Session = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user_id)):
    """Active stories of the verified providers I follow, grouped by provider."""
    followed_by_me = Provider.id.in_(select(Follow.provider_id).where(Follow.user_id == user_id))
    return StoryGroupList(items=load_story_groups(db, [followed_by_me]))
