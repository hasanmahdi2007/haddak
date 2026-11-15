"""Turns Provider database rows into the JSON shapes from docs/API.md.

Three levels, each adding fields to the one before:
  ProviderSummary -> ProviderDetail -> OwnProvider (owner and admin only).
"""

from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.models import Provider
from app.schemas import CategoryBrief, OwnProvider, ProviderDetail, ProviderSummary
from app.services.contact_stats import public_contact_count
from app.services.opening_hours import is_open_now


def current_date() -> date:
    """Today's date (UTC). "Featured" means featured_until >= today."""
    return datetime.now(UTC).date()


def current_time() -> datetime:
    """This moment. A separate function so tests can replace it."""
    return datetime.now(UTC)


def summary_fields(provider: Provider, distance_m: float | None) -> dict:
    is_verified = provider.status == "verified"
    # "Featured" only counts for verified providers, here and in the ranking.
    is_featured = (
        is_verified
        and provider.featured_until is not None
        and provider.featured_until >= current_date()
    )
    return {
        "id": provider.id,
        "slug": provider.slug,
        "name": provider.name,
        "category": CategoryBrief.model_validate(provider.category),
        "area_name": provider.area_name,
        "price_text": provider.price_text,
        "avg_rating": float(provider.avg_rating),
        "review_count": provider.review_count,
        # The public never gets the raw status: 'pending' and 'unverified'
        # both simply show as verified = False.
        "verified": is_verified,
        "claimed": provider.owner_user_id is not None,
        "founding_member": provider.founding_member,
        "featured": is_featured,
        "lat": provider.lat,
        "lng": provider.lng,
        "distance_m": None if distance_m is None else round(distance_m),
        "cover_photo_url": provider.photos[0] if provider.photos else None,
        "open_now": is_open_now(provider.opening_hours, current_time()),
    }


def detail_fields(db: Session, provider: Provider, distance_m: float | None) -> dict:
    fields = summary_fields(provider, distance_m)
    fields.update(
        description=provider.description,
        phone=provider.phone,
        # A null whatsapp in the database means "same as phone", so the app
        # always receives a number it can open WhatsApp with.
        whatsapp=provider.whatsapp or provider.phone,
        photos=provider.photos,
        created_at=provider.created_at,
        opening_hours=provider.opening_hours,
        # One small extra query, and only for providers who show their count.
        contacts_this_month=public_contact_count(db, provider),
    )
    return fields


def to_summary(provider: Provider, distance_m: float | None) -> ProviderSummary:
    return ProviderSummary(**summary_fields(provider, distance_m))


def to_detail(db: Session, provider: Provider, distance_m: float | None = None) -> ProviderDetail:
    return ProviderDetail(**detail_fields(db, provider, distance_m))


def to_own(db: Session, provider: Provider) -> OwnProvider:
    return OwnProvider(
        **detail_fields(db, provider, None),
        status=provider.status,
        source=provider.source,
        featured_until=provider.featured_until,
        verification_doc_url=provider.verification_doc_url,
        show_contact_count=provider.show_contact_count,
    )
