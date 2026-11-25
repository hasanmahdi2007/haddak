"""Public provider endpoints: search, detail, share-code lookup, contact events, reports."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_optional_user_id
from app.db import get_db
from app.models import PUBLIC_STATUSES, Provider, ProviderReport
from app.rate_limit import (
    get_client_ip,
    limit_contact_events,
    limit_reads,
    limit_reports,
    limit_searches,
)
from app.schemas import (
    MAX_INT32,
    ContactEventIn,
    PriceCurrency,
    PriceUnit,
    ProviderDetail,
    ProviderSearchResult,
    ReportCreated,
    ReportIn,
)
from app.services import provider_views
from app.services.contact_stats import record_contact_event as store_contact_event
from app.services.hire_checks import maybe_create_check
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

# Deeper pages than this are refused (422): nobody scrolls 10,000 results,
# and a huge offset makes the database sort every match for nothing.
MAX_OFFSET = 10_000


@router.get(
    "/providers/search",
    response_model=ProviderSearchResult,
    dependencies=[Depends(limit_searches)],
)
def search(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_m: int = Query(ge=100, le=50000),
    category_id: int | None = Query(default=None, ge=1, le=MAX_INT32),
    # Search box text: matches the provider's name, its category (or the
    # category's group, aliases included) or its area. Name matches first.
    q: str | None = Query(default=None, min_length=2, max_length=60),
    # False (the default): verified providers only. True: also unverified ones.
    include_unverified: bool = False,
    # Price filter: structured price <= max_price in this unit and currency.
    max_price: float | None = Query(default=None, gt=0),
    price_unit: PriceUnit | None = None,
    price_currency: PriceCurrency = "USD",
    # True: only providers whose opening hours say open now (Beirut time),
    # or who are marked "Available now".
    open_now: bool = False,
    # True: only providers marked "Available now".
    available_now: bool = False,
    sort: Literal["best", "distance", "price"] = "best",
    # The app pages 20 at a time and asks for up to 100 for the map.
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=MAX_OFFSET),
    db: Session = Depends(get_db),
):
    if max_price is not None and price_unit is None:
        # "Under $20" means nothing without "per hour" / "per visit" / ...
        raise HTTPException(status_code=422, detail="price_unit is required with max_price")
    rows, total = search_providers(
        db,
        lat=lat,
        lng=lng,
        radius_m=radius_m,
        today=current_date(),
        category_id=category_id,
        text_query=q,
        include_unverified=include_unverified,
        max_price=max_price,
        price_unit=price_unit,
        price_currency=price_currency,
        open_now=open_now,
        available_now=available_now,
        # Read through the module so tests can replace the clock.
        now=provider_views.current_time(),
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return ProviderSearchResult(items=to_summaries(db, rows), total=total)


@router.get(
    "/providers/by-slug/{slug}",
    response_model=ProviderDetail,
    dependencies=[Depends(limit_reads)],
)
def get_provider_by_slug(
    slug: str = Path(max_length=64),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
    # None when nobody is logged in; only used to fill is_following.
    viewer_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    provider = require_public(db.scalar(select(Provider).where(Provider.slug == slug)))
    return detail_response(db, provider, lat, lng, viewer_id)


@router.get(
    "/providers/{provider_id}", response_model=ProviderDetail, dependencies=[Depends(limit_reads)]
)
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
    user_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    """Count a profile view, a WhatsApp tap or a call tap. No login needed.

    When a signed-in user taps WhatsApp or Call, a "Did you hire them?"
    check is also stored, so the app can ask them later.
    """
    provider = get_public_provider(db, provider_id)

    # The same person tapping again within 10 minutes gets the same 204
    # answer, but is not counted twice; only signed-in taps count in the
    # public number (rules in services/contact_stats.py).
    store_contact_event(db, provider.id, body.type, user_id, get_client_ip(request))

    # Checks have their own 7-day rule (inside maybe_create_check), so they
    # do not depend on the 10-minute rule above.
    if user_id is not None and body.type in ("whatsapp", "call"):
        maybe_create_check(db, provider, user_id, body.type)

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
