"""Endpoints for the logged-in user's own provider profile."""

import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models import Category, ContactEvent, Provider
from app.rate_limit import limit_writes
from app.schemas import OwnProvider, ProviderCreate, ProviderStats, ProviderUpdate
from app.services.geo import point_for_storage
from app.services.provider_views import to_own

router = APIRouter(tags=["me"])

# Share codes use letters and digits that are hard to mix up when read aloud
# or typed from a poster (no 0/o, 1/l/i).
SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
SLUG_LENGTH = 6


def generate_slug(db: Session) -> str:
    """A random share code that no other provider uses yet."""
    while True:
        slug = "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))
        already_used = db.scalar(select(Provider.id).where(Provider.slug == slug))
        if already_used is None:
            return slug


def find_my_provider(db: Session, user_id: uuid.UUID) -> Provider | None:
    return db.scalar(select(Provider).where(Provider.owner_user_id == user_id))


def get_my_provider_or_404(db: Session, user_id: uuid.UUID) -> Provider:
    provider = find_my_provider(db, user_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="You do not have a provider profile yet")
    return provider


def require_category(db: Session, category_id: int) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(status_code=400, detail="Unknown category_id")


@router.get("/me/provider", response_model=OwnProvider)
def get_my_provider(
    db: Session = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user_id)
):
    return to_own(get_my_provider_or_404(db, user_id))


@router.post(
    "/me/provider",
    response_model=OwnProvider,
    status_code=201,
    dependencies=[Depends(limit_writes)],
)
def create_my_provider(
    body: ProviderCreate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    already_exists = HTTPException(status_code=409, detail="You already have a provider profile")
    if find_my_provider(db, user_id) is not None:
        raise already_exists
    require_category(db, body.category_id)

    # status, founding_member and featured_until are not set here: new
    # profiles start as 'pending' and only the admin changes those.
    provider = Provider(
        owner_user_id=user_id,
        slug=generate_slug(db),
        name=body.name,
        category_id=body.category_id,
        description=body.description,
        price_text=body.price_text,
        phone=body.phone,
        whatsapp=body.whatsapp,
        location=point_for_storage(body.lat, body.lng),
        area_name=body.area_name,
        photos=body.photos,
        verification_doc_url=body.verification_doc_url,
    )
    db.add(provider)
    try:
        db.commit()
    except IntegrityError as error:
        # Two create requests arrived at the same moment; the database's
        # UNIQUE (owner_user_id) rule stopped the second one.
        db.rollback()
        raise already_exists from error
    db.refresh(provider)
    return to_own(provider)


@router.patch("/me/provider", response_model=OwnProvider, dependencies=[Depends(limit_writes)])
def update_my_provider(
    body: ProviderUpdate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    provider = get_my_provider_or_404(db, user_id)

    # Only the fields the app actually sent; everything else stays as it is.
    changes = body.model_dump(exclude_unset=True)

    if "category_id" in changes:
        require_category(db, changes["category_id"])

    # lat and lng live together in one `location` column. If only one of
    # them was sent, keep the other from the current location.
    if "lat" in changes or "lng" in changes:
        new_lat = changes.pop("lat", provider.lat)
        new_lng = changes.pop("lng", provider.lng)
        provider.location = point_for_storage(new_lat, new_lng)

    for field_name, value in changes.items():
        setattr(provider, field_name, value)

    db.commit()
    db.refresh(provider)
    return to_own(provider)


@router.get("/me/provider/stats", response_model=ProviderStats)
def get_my_stats(db: Session = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user_id)):
    """How many views, WhatsApp taps and call taps my profile got this month."""
    provider = get_my_provider_or_404(db, user_id)

    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rows = db.execute(
        select(ContactEvent.type, func.count())
        .where(ContactEvent.provider_id == provider.id, ContactEvent.created_at >= month_start)
        .group_by(ContactEvent.type)
    )
    counts = {event_type: count for event_type, count in rows}

    return ProviderStats(
        month=now.strftime("%Y-%m"),
        views=counts.get("view", 0),
        whatsapp=counts.get("whatsapp", 0),
        calls=counts.get("call", 0),
    )
