"""Stories and banners: a verified provider's short posts and current offer."""

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models import Banner, Provider, Story
from app.rate_limit import limit_writes
from app.routers.me import get_my_provider_or_404
from app.routers.providers import get_public_provider
from app.schemas import BannerIn, BannerOut, StoryCreate, StoryGroupList, StoryList, StoryOut
from app.services.geo import point_for_query
from app.services.posts import (
    MAX_ACTIVE_STORIES,
    STORY_LIFETIME,
    active_stories,
    count_active_stories,
)
from app.services.provider_views import current_time
from app.services.story_feed import load_story_groups

router = APIRouter(tags=["stories and banners"])


def get_my_verified_provider_locked(db: Session, user_id: uuid.UUID) -> Provider:
    """My provider, for posting: 404 if I have none, 403 if it is not verified.

    FOR UPDATE locks the provider row until this request commits. Two posts
    sent at the same moment then run one after the other, so the "5 active
    stories" limit and the "one banner" rule cannot be broken by a race.
    """
    provider = db.scalar(
        select(Provider).where(Provider.owner_user_id == user_id).with_for_update(of=Provider)
    )
    if provider is None:
        raise HTTPException(status_code=404, detail="You do not have a provider profile yet")
    if provider.status != "verified":
        raise HTTPException(status_code=403, detail="Only verified providers can post")
    return provider


# ---------- my stories ----------


@router.post(
    "/me/provider/stories",
    response_model=StoryOut,
    status_code=201,
    dependencies=[Depends(limit_writes)],
)
def post_story(
    body: StoryCreate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    provider = get_my_verified_provider_locked(db, user_id)

    now = current_time()
    if count_active_stories(db, provider.id, now) >= MAX_ACTIVE_STORIES:
        raise HTTPException(
            status_code=409,
            detail=f"You already have {MAX_ACTIVE_STORIES} active stories. "
            "Delete one or wait until one expires.",
        )

    story = Story(
        provider_id=provider.id,
        text=body.text,
        image_url=body.image_url,
        created_at=now,
        expires_at=now + STORY_LIFETIME,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


@router.delete(
    "/me/provider/stories/{story_id}", status_code=204, dependencies=[Depends(limit_writes)]
)
def delete_my_story(
    story_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    provider = get_my_provider_or_404(db, user_id)

    story = db.get(Story, story_id)
    # Somebody else's story answers exactly like a missing one.
    if story is None or story.provider_id != provider.id:
        raise HTTPException(status_code=404, detail="Story not found")
    db.delete(story)
    db.commit()
    return Response(status_code=204)


# ---------- my banner ----------


@router.put("/me/provider/banner", response_model=BannerOut, dependencies=[Depends(limit_writes)])
def set_my_banner(
    body: BannerIn,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Create my banner, or overwrite the one I have (there is only ever one)."""
    provider = get_my_verified_provider_locked(db, user_id)

    banner = db.get(Banner, provider.id)
    if banner is None:
        banner = Banner(provider_id=provider.id)
        db.add(banner)

    now = current_time()
    banner.title = body.title
    banner.text = body.text
    banner.discount_percent = body.discount_percent
    banner.starts_at = now
    banner.expires_at = now + timedelta(days=body.days)

    db.commit()
    db.refresh(banner)
    return banner


@router.delete("/me/provider/banner", status_code=204, dependencies=[Depends(limit_writes)])
def delete_my_banner(
    db: Session = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user_id)
):
    provider = get_my_provider_or_404(db, user_id)

    banner = db.get(Banner, provider.id)
    if banner is not None:
        db.delete(banner)
        db.commit()
    # 204 also when there was no banner: the result is the same.
    return Response(status_code=204)


# ---------- public ----------


@router.get("/providers/{provider_id}/stories", response_model=StoryList)
def list_provider_stories(provider_id: uuid.UUID, db: Session = Depends(get_db)):
    """A provider's active stories, newest first."""
    provider = get_public_provider(db, provider_id)

    # Stories are only shown while the provider is verified.
    if provider.status != "verified":
        return StoryList(items=[])
    return StoryList(items=active_stories(db, [provider.id], current_time()))


@router.get("/stories/nearby", response_model=StoryGroupList)
def stories_nearby(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_m: int = Query(ge=100, le=50000),
    db: Session = Depends(get_db),
):
    """Active stories of verified providers inside the circle, grouped by provider."""
    inside_circle = func.ST_DWithin(Provider.location, point_for_query(lat, lng), radius_m)
    return StoryGroupList(items=load_story_groups(db, [inside_circle], lat=lat, lng=lng))
