"""Public provider endpoints: search, detail, share-code lookup, contact events, reports."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_optional_user_id
from app.db import get_db
from app.models import PUBLIC_STATUSES, ContactEvent, Provider, ProviderReport
from app.rate_limit import is_repeated_contact_event, limit_contact_events, limit_reports
from app.schemas import (
    ContactEventIn,
    ProviderDetail,
    ProviderSearchResult,
    ReportCreated,
    ReportIn,
)
from app.services.provider_views import current_date, to_detail, to_summaries
from app.services.search import distance_to_provider, search_providers

router = APIRouter(tags=["providers"])


def require_public(provider: Provider | None) -> Provider:
    """Raise 404 unless the public is allowed to see this provider.

    Verified, unverified and pending profiles are public. A rejected profile
    answers exactly like a missing one, so nobody can find out it exists.
    """
    if provider is None or provider.status not in PUBLIC_STATUSES:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


def get_public_provider(db: Session, provider_id: uuid.UUID) -> Provider:
    """Load a provider the public is allowed to see, or raise 404."""
    return require_public(db.get(Provider, provider_id))


def detail_response(
    db: Session,
    provider: Provider,
    lat: float | None,
    lng: float | None,
    viewer_id: uuid.UUID | None,
) -> ProviderDetail:
    distance_m = None
    if lat is not None and lng is not None:
        distance_m = distance_to_provider(db, provider.id, lat, lng)
    return to_detail(db, provider, distance_m, viewer_id)


# Note: the fixed paths (/search, /by-slug/...) are declared before
# /providers/{provider_id}, because FastAPI tries routes in order.


@router.get("/providers/search", response_model=ProviderSearchResult)
def search(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_m: int = Query(ge=100, le=50000),
    category_id: int | None = None,
    q: str | None = Query(default=None, min_length=2, max_length=60),
    # False (the default): verified providers only. True: also unverified ones.
    include_unverified: bool = False,
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
        include_unverified=include_unverified,
        limit=limit,
        offset=offset,
    )
    return ProviderSearchResult(items=to_summaries(db, rows), total=total)


@router.get("/providers/by-slug/{slug}", response_model=ProviderDetail)
def get_provider_by_slug(
    slug: str,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
    # None when nobody is logged in; only used to fill is_following.
    viewer_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    provider = require_public(db.scalar(select(Provider).where(Provider.slug == slug)))
    return detail_response(db, provider, lat, lng, viewer_id)


@router.get("/providers/{provider_id}", response_model=ProviderDetail)
def get_provider(
    provider_id: uuid.UUID,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
    viewer_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    provider = get_public_provider(db, provider_id)
    return detail_response(db, provider, lat, lng, viewer_id)


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
    provider = get_public_provider(db, provider_id)

    # The same person tapping again within 10 minutes gets the same 204
    # answer, but is not counted twice. This keeps provider stats honest.
    if not is_repeated_contact_event(request, provider.id, body.type):
        db.add(ContactEvent(provider_id=provider.id, type=body.type))
        db.commit()
    return Response(status_code=204)


@router.post(
    "/providers/{provider_id}/reports",
    response_model=ReportCreated,
    status_code=201,
    dependencies=[Depends(limit_reports)],
)
def report_provider(provider_id: uuid.UUID, body: ReportIn, db: Session = Depends(get_db)):
    """Flag a listing as wrong, fake, closed or offensive. No login needed.

    Nothing about the sender is stored (no user id, no IP). The admin reads
    the reports through routers/admin.py.
    """
    provider = get_public_provider(db, provider_id)

    report = ProviderReport(provider_id=provider.id, reason=body.reason, note=body.note)
    db.add(report)
    db.commit()
    return ReportCreated(id=report.id)
