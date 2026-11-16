"""Admin endpoints. Every route here needs the X-Admin-Key header."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.config import settings
from app.db import get_db
from app.models import AssistLog, Banner, Provider, ProviderReport, ProviderSuggestion, Story
from app.routers.me import generate_slug, require_category, require_price_pair
from app.schemas import (
    AdminBannerList,
    AdminProviderUpdate,
    AdminStoryList,
    AssistWanted,
    OwnProvider,
    OwnProviderList,
    ProviderStatus,
    ReportList,
    SuggestionList,
    SuggestionPublish,
)
from app.services.assist.budget import month_spend_usd, month_start
from app.services.geo import point_for_storage
from app.services.provider_views import to_own

# dependencies=[...] applies the admin-key check to all routes in this file.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

# What a listing published from a suggestion must have, after the admin's
# body has been merged over the suggestion.
PUBLISH_REQUIRED_FIELDS = ["name", "phone", "category_id", "area_name", "lat", "lng"]

# The columns copied from a Story / Banner row into the admin list items.
STORY_FIELDS = ["id", "provider_id", "text", "image_url", "created_at", "expires_at"]
BANNER_FIELDS = [
    "provider_id",
    "title",
    "text",
    "discount_percent",
    "starts_at",
    "expires_at",
]


@router.get("/providers", response_model=OwnProviderList)
def list_providers_by_status(
    status: ProviderStatus = "pending",
    db: Session = Depends(get_db),
):
    """Profiles with the given status, oldest first (a review queue)."""
    query = (
        select(Provider).where(Provider.status == status).order_by(Provider.created_at, Provider.id)
    )
    items = [to_own(db, provider) for provider in db.scalars(query)]
    total = db.scalar(select(func.count()).select_from(Provider).where(Provider.status == status))
    return OwnProviderList(items=items, total=total or 0)


@router.patch("/providers/{provider_id}", response_model=OwnProvider)
def update_provider(
    provider_id: uuid.UUID, body: AdminProviderUpdate, db: Session = Depends(get_db)
):
    """Change a profile's status, or set founding member / featured.

    The admin page's status buttons all come here:
      Approve       -> status "verified"
      Decline proof -> status "unverified" (from pending; the listing stays visible)
      Reject        -> status "rejected"   (hidden everywhere public)
      Restore       -> status "unverified" (from rejected)
    """
    provider = db.get(Provider, provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    changes = body.model_dump(exclude_unset=True)
    for field_name, value in changes.items():
        setattr(provider, field_name, value)
    require_price_pair(provider)

    db.commit()
    db.refresh(provider)
    return to_own(db, provider)


@router.get("/suggestions", response_model=SuggestionList)
def list_suggestions(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Suggested providers, newest first."""
    query = (
        select(ProviderSuggestion)
        .order_by(ProviderSuggestion.created_at.desc(), ProviderSuggestion.id)
        .limit(limit)
        .offset(offset)
    )
    # response_model converts each row to SuggestionOut (from_attributes=True).
    items = list(db.scalars(query))
    total = db.scalar(select(func.count()).select_from(ProviderSuggestion))
    return {"items": items, "total": total or 0}


@router.delete("/suggestions/{suggestion_id}", status_code=204)
def delete_suggestion(suggestion_id: uuid.UUID, db: Session = Depends(get_db)):
    """Remove a suggestion once it has been dealt with."""
    suggestion = db.get(ProviderSuggestion, suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    db.delete(suggestion)
    db.commit()
    return Response(status_code=204)


@router.post("/suggestions/{suggestion_id}/publish", response_model=OwnProvider, status_code=201)
def publish_suggestion(
    suggestion_id: uuid.UUID,
    body: SuggestionPublish | None = None,
    db: Session = Depends(get_db),
):
    """Turn a suggestion into a public, unverified listing with no owner.

    The body can override or supply fields; whatever it leaves out comes
    from the suggestion.
    """
    # FOR UPDATE locks the suggestion row: if "Publish" is sent twice at the
    # same moment, the second request waits, then finds the row gone (404)
    # instead of creating a second listing.
    suggestion = db.scalar(
        select(ProviderSuggestion)
        .where(ProviderSuggestion.id == suggestion_id)
        .with_for_update(of=ProviderSuggestion)
    )
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    # Start from the suggestion, then put the admin's values on top.
    fields = {
        "name": suggestion.name,
        "phone": suggestion.phone,
        "category_id": suggestion.category_id,
        "area_name": suggestion.area_name,
        "lat": suggestion.lat,
        "lng": suggestion.lng,
        # The suggestion's note was written for the admin, so it is not
        # published: the description only comes from the body.
        "description": "",
    }
    if body is not None:
        fields.update(body.model_dump(exclude_none=True))

    missing = [name for name in PUBLISH_REQUIRED_FIELDS if fields[name] in (None, "")]
    if missing:
        raise HTTPException(status_code=422, detail="Missing: " + ", ".join(missing))
    require_category(db, fields["category_id"])

    provider = Provider(
        owner_user_id=None,  # nobody has claimed this listing
        source="suggestion",
        status="unverified",
        slug=generate_slug(db),
        name=fields["name"],
        category_id=fields["category_id"],
        description=fields["description"],
        phone=fields["phone"],
        location=point_for_storage(fields["lat"], fields["lng"]),
        area_name=fields["area_name"],
    )
    db.add(provider)
    db.delete(suggestion)
    # One commit = one transaction: the listing appears and the suggestion
    # disappears together, or neither happens.
    db.commit()
    db.refresh(provider)
    return to_own(db, provider)


@router.get("/reports", response_model=ReportList)
def list_reports(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Reported listings, newest first."""
    query = (
        select(ProviderReport)
        .order_by(ProviderReport.created_at.desc(), ProviderReport.id)
        .limit(limit)
        .offset(offset)
    )
    # response_model converts each row to ReportOut, including the provider's
    # id, name and status (loaded in the same query, see models.py).
    items = list(db.scalars(query))
    total = db.scalar(select(func.count()).select_from(ProviderReport))
    return {"items": items, "total": total or 0}


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(report_id: uuid.UUID, db: Session = Depends(get_db)):
    """Dismiss a report once it has been dealt with."""
    report = db.get(ProviderReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return Response(status_code=204)


@router.get("/stories", response_model=AdminStoryList)
def list_stories(db: Session = Depends(get_db)):
    """Active stories (not expired yet), newest first, with the provider's name.

    Expired rows stay in the table but nobody sees them, so they are not listed.
    """
    query = (
        select(Story, Provider.name)
        .join(Provider, Provider.id == Story.provider_id)
        .where(Story.expires_at > datetime.now(UTC))
        .order_by(Story.created_at.desc(), Story.id)
        .limit(200)
    )
    # Each row is a (Story, provider name) pair.
    items = [
        {**{c: getattr(story, c) for c in STORY_FIELDS}, "provider_name": name}
        for story, name in db.execute(query)
    ]
    return {"items": items}


@router.get("/banners", response_model=AdminBannerList)
def list_banners(db: Session = Depends(get_db)):
    """Active banners (not expired yet), the ones expiring soonest first."""
    query = (
        select(Banner, Provider.name)
        .join(Provider, Provider.id == Banner.provider_id)
        .where(Banner.expires_at > datetime.now(UTC))
        .order_by(Banner.expires_at, Banner.provider_id)
        .limit(200)
    )
    items = [
        {**{c: getattr(banner, c) for c in BANNER_FIELDS}, "provider_name": name}
        for banner, name in db.execute(query)
    ]
    return {"items": items}


@router.delete("/stories/{story_id}", status_code=204)
def delete_story(story_id: uuid.UUID, db: Session = Depends(get_db)):
    """Remove any story (e.g. an offensive one)."""
    story = db.get(Story, story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    db.delete(story)
    db.commit()
    return Response(status_code=204)


@router.delete("/providers/{provider_id}/banner", status_code=204)
def delete_banner(provider_id: uuid.UUID, db: Session = Depends(get_db)):
    """Remove a provider's banner. A banner has no id of its own: there is at
    most one per provider, so the provider id identifies it."""
    banner = db.get(Banner, provider_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    db.delete(banner)
    db.commit()
    return Response(status_code=204)


# How far back the "most wanted" list looks, and how many entries it shows.
WANTED_DAYS = 30
WANTED_LIMIT = 50


@router.get("/assist/wanted", response_model=AssistWanted)
def assist_wanted(db: Session = Depends(get_db)):
    """What people asked the assistant for and did not find (last 30 days),
    most asked first, plus this month's AI spending.

    `wanted_text` is the normalised sentence, stored only for requests whose
    search found nothing. Same sentences are counted together.
    """
    since = datetime.now(UTC) - timedelta(days=WANTED_DAYS)

    wanted_query = (
        select(AssistLog.wanted_text, func.count(), func.max(AssistLog.created_at))
        .where(AssistLog.wanted_text.is_not(None), AssistLog.created_at >= since)
        .group_by(AssistLog.wanted_text)
        .order_by(func.count().desc(), func.max(AssistLog.created_at).desc())
        .limit(WANTED_LIMIT)
    )
    items = [
        {"text": text, "count": count, "last_seen": last_seen}
        for text, count, last_seen in db.execute(wanted_query)
    ]

    places_query = (
        select(AssistLog.place_unknown, func.count())
        .where(AssistLog.place_unknown.is_not(None), AssistLog.created_at >= since)
        .group_by(AssistLog.place_unknown)
        .order_by(func.count().desc(), AssistLog.place_unknown)
        .limit(WANTED_LIMIT)
    )
    unknown_places = [{"name": name, "count": count} for name, count in db.execute(places_query)]

    start = month_start()
    ai_requests = db.scalar(
        select(func.count())
        .select_from(AssistLog)
        .where(AssistLog.source == "ai", AssistLog.created_at >= start)
    )
    return {
        "month": start.strftime("%Y-%m"),
        "month_spend_usd": float(month_spend_usd(db)),
        "month_budget_usd": settings.assist_monthly_budget_usd,
        "month_ai_requests": ai_requests or 0,
        "items": items,
        "unknown_places": unknown_places,
    }
