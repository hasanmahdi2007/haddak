"""Turns Provider database rows into the JSON shapes from docs/API.md.

Three levels, each adding fields to the one before:
  ProviderSummary -> ProviderDetail -> OwnProvider (owner and admin only).
"""

from datetime import UTC, date, datetime

from app.models import Provider
from app.schemas import CategoryBrief, OwnProvider, ProviderDetail, ProviderSummary


def current_date() -> date:
    """Today's date (UTC). "Featured" means featured_until >= today."""
    return datetime.now(UTC).date()


def summary_fields(provider: Provider, distance_m: float | None) -> dict:
    is_featured = provider.featured_until is not None and provider.featured_until >= current_date()
    return {
        "id": provider.id,
        "slug": provider.slug,
        "name": provider.name,
        "category": CategoryBrief.model_validate(provider.category),
        "area_name": provider.area_name,
        "price_text": provider.price_text,
        "avg_rating": float(provider.avg_rating),
        "review_count": provider.review_count,
        "verified": provider.status == "verified",
        "founding_member": provider.founding_member,
        "featured": is_featured,
        "lat": provider.lat,
        "lng": provider.lng,
        "distance_m": None if distance_m is None else round(distance_m),
        "cover_photo_url": provider.photos[0] if provider.photos else None,
    }


def detail_fields(provider: Provider, distance_m: float | None) -> dict:
    fields = summary_fields(provider, distance_m)
    fields.update(
        description=provider.description,
        phone=provider.phone,
        # A null whatsapp in the database means "same as phone", so the app
        # always receives a number it can open WhatsApp with.
        whatsapp=provider.whatsapp or provider.phone,
        photos=provider.photos,
        created_at=provider.created_at,
    )
    return fields


def to_summary(provider: Provider, distance_m: float | None) -> ProviderSummary:
    return ProviderSummary(**summary_fields(provider, distance_m))


def to_detail(provider: Provider, distance_m: float | None = None) -> ProviderDetail:
    return ProviderDetail(**detail_fields(provider, distance_m))


def to_own(provider: Provider) -> OwnProvider:
    return OwnProvider(
        **detail_fields(provider, None),
        status=provider.status,
        featured_until=provider.featured_until,
        verification_doc_url=provider.verification_doc_url,
    )
