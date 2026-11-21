"""Turns Provider database rows into the JSON shapes from docs/API.md.

Three levels, each adding fields to the one before:
  ProviderSummary -> ProviderDetail -> OwnProvider (owner and admin only).
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.models import Banner, Provider
from app.schemas import BannerOut, CategoryBrief, OwnProvider, ProviderDetail, ProviderSummary
from app.services.contact_stats import public_contact_count
from app.services.follows import follower_count, is_following
from app.services.hire_checks import confirmed_hires
from app.services.opening_hours import is_open_now
from app.services.posts import PostInfo, load_post_info


def current_date() -> date:
    """Today's date (UTC). "Featured" means featured_until >= today."""
    return datetime.now(UTC).date()


def current_time() -> datetime:
    """This moment. A separate function so tests can replace it."""
    return datetime.now(UTC)


def is_available_now(provider: Provider, now: datetime) -> bool:
    """True while the owner's "Available now" switch has not run out."""
    return provider.available_until is not None and provider.available_until > now


def visible_banner(provider: Provider, posts: PostInfo) -> Banner | None:
    """The provider's active banner, or None.

    Posts are only shown while the provider is verified: if the badge is
    taken away, the banner and the stories disappear with it.
    """
    if provider.status != "verified":
        return None
    return posts.banners.get(provider.id)


def summary_fields(provider: Provider, distance_m: float | None, posts: PostInfo) -> dict:
    """`posts` holds the active stories and banners of (at least) this provider.
    The caller loads it once per response, see to_summaries()."""
    is_verified = provider.status == "verified"
    # "Featured" only counts for verified providers, here and in the ranking.
    is_featured = (
        is_verified
        and provider.featured_until is not None
        and provider.featured_until >= current_date()
    )
    banner = visible_banner(provider, posts)
    return {
        "id": provider.id,
        "slug": provider.slug,
        "name": provider.name,
        "category": CategoryBrief.model_validate(provider.category),
        "area_name": provider.area_name,
        "price_text": provider.price_text,
        "price_amount": None if provider.price_amount is None else float(provider.price_amount),
        "price_unit": provider.price_unit,
        "price_currency": provider.price_currency,
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
        "available_now": is_available_now(provider, current_time()),
        # "Sponsored" is the name users see for "featured".
        "sponsored": is_featured,
        "sponsor_hook": provider.sponsor_hook if is_featured else None,
        "has_active_story": is_verified and provider.id in posts.story_provider_ids,
        "banner_title": banner.title if banner else None,
        # Imported OpenStreetMap data must be shown with attribution (ODbL).
        "data_source": "osm" if provider.source == "osm" else None,
    }


def detail_fields(
    db: Session,
    provider: Provider,
    distance_m: float | None,
    viewer_id: uuid.UUID | None = None,
) -> dict:
    """`viewer_id` is the logged-in caller, if any; only used for is_following."""
    posts = load_post_info(db, [provider.id], current_time())
    banner = visible_banner(provider, posts)
    fields = summary_fields(provider, distance_m, posts)
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
        active_banner=BannerOut.model_validate(banner) if banner else None,
        follower_count=follower_count(db, provider.id),
        is_following=is_following(db, viewer_id, provider.id),
        confirmed_hires=confirmed_hires(db, provider.id),
    )
    return fields


def to_summaries(db: Session, rows: list[tuple[Provider, float | None]]) -> list[ProviderSummary]:
    """Convert a whole list of (provider, distance) rows.

    The stories and banners of all of them are loaded together (two queries
    in total), not one by one: a page of 30 results costs the same number of
    queries as a page of 1.
    """
    provider_ids = [provider.id for provider, _ in rows]
    posts = load_post_info(db, provider_ids, current_time())
    return [
        ProviderSummary(**summary_fields(provider, distance_m, posts))
        for provider, distance_m in rows
    ]


def to_detail(
    db: Session,
    provider: Provider,
    distance_m: float | None = None,
    viewer_id: uuid.UUID | None = None,
) -> ProviderDetail:
    return ProviderDetail(**detail_fields(db, provider, distance_m, viewer_id))


def to_own(db: Session, provider: Provider) -> OwnProvider:
    fields = detail_fields(db, provider, None)
    # The owner (and the admin) always see the stored hook, sponsored or not.
    fields["sponsor_hook"] = provider.sponsor_hook
    return OwnProvider(
        **fields,
        status=provider.status,
        source=provider.source,
        featured_until=provider.featured_until,
        verification_doc_url=provider.verification_doc_url,
        show_contact_count=provider.show_contact_count,
        available_until=provider.available_until,
    )
