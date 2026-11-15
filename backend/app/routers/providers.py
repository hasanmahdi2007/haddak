"""Public provider endpoints: search, detail, share-code lookup, contact events."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ContactEvent, Provider
from app.rate_limit import is_repeated_contact_event, limit_contact_events
from app.schemas import ContactEventIn, ProviderDetail, ProviderSearchResult
from app.services.provider_views import current_date, to_detail, to_summary
from app.services.search import distance_to_provider, search_providers

router = APIRouter(tags=["providers"])


def get_verified_provider(db: Session, provider_id: uuid.UUID) -> Provider:
    """Load a provider the public is allowed to see, or raise 404.

    Pending and rejected profiles answer exactly like missing ones, so nobody
    can find out that an unverified profile exists.
    """
    provider = db.get(Provider, provider_id)
    if provider is None or provider.status != "verified":
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


def detail_response(
    db: Session, provider: Provider, lat: float | None, lng: float | None
) -> ProviderDetail:
    distance_m = None
    if lat is not None and lng is not None:
        distance_m = distance_to_provider(db, provider.id, lat, lng)
    return to_detail(db, provider, distance_m)


# Note: the fixed paths (/search, /by-slug/...) are declared before
# /providers/{provider_id}, because FastAPI tries routes in order.


@router.get("/providers/search", response_model=ProviderSearchResult)
def search(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_m: int = Query(ge=100, le=50000),
    category_id: int | None = None,
    q: str | None = Query(default=None, min_length=2, max_length=60),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    rows, total = search_providers(
        db,
        lat=lat,
        lng=lng,
        radius_m=radius_m,
        today=current_date(),
        category_id=category_id,
        name_contains=q,
        limit=limit,
        offset=offset,
    )
    items = [to_summary(provider, distance_m) for provider, distance_m in rows]
    return ProviderSearchResult(items=items, total=total)


@router.get("/providers/by-slug/{slug}", response_model=ProviderDetail)
def get_provider_by_slug(
    slug: str,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
):
    provider = db.scalar(select(Provider).where(Provider.slug == slug))
    if provider is None or provider.status != "verified":
        raise HTTPException(status_code=404, detail="Provider not found")
    return detail_response(db, provider, lat, lng)


@router.get("/providers/{provider_id}", response_model=ProviderDetail)
def get_provider(
    provider_id: uuid.UUID,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
):
    provider = get_verified_provider(db, provider_id)
    return detail_response(db, provider, lat, lng)


@router.post(
    "/providers/{provider_id}/contact-events",
    status_code=204,
    dependencies=[Depends(limit_contact_events)],
)
def record_contact_event(
    provider_id: uuid.UUID,
    body: ContactEventIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """Count a profile view, a WhatsApp tap or a call tap. No login needed."""
    provider = get_verified_provider(db, provider_id)

    # The same person tapping again within 10 minutes gets the same 204
    # answer, but is not counted twice. This keeps provider stats honest.
    if not is_repeated_contact_event(request, provider.id, body.type):
        db.add(ContactEvent(provider_id=provider.id, type=body.type))
        db.commit()
    return Response(status_code=204)
