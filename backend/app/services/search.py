"""Radius search. Implements the "Search query" section of docs/SCHEMA.md."""

import uuid
from datetime import date

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.models import Category, Provider
from app.services.geo import point_for_query

# Weighted rating: pretend every provider also has 5 extra reviews of 3.5
# stars. A provider with one 5-star review then scores about 3.75, while one
# with fifty 4.8-star reviews scores about 4.68, so a single lucky review
# cannot outrank a long good record.
PRIOR_REVIEW_COUNT = 5
PRIOR_RATING = 3.5


def category_with_children_ids(db: Session, category_id: int) -> list[int]:
    """The category's own id plus the ids of its direct children."""
    query = select(Category.id).where(
        or_(Category.id == category_id, Category.parent_id == category_id)
    )
    return list(db.scalars(query))


def search_providers(
    db: Session,
    *,
    lat: float,
    lng: float,
    radius_m: int,
    today: date,
    category_id: int | None = None,
    name_contains: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> tuple[list[tuple[Provider, float]], int]:
    """Return (rows, total). Each row is (provider, distance in metres).

    `total` counts every match, ignoring limit and offset, so the app knows
    whether there are more pages.
    """
    search_point = point_for_query(lat, lng)

    # 1. Filter: public (verified) providers inside the circle.
    #    ST_DWithin can use the GIST index on providers.location.
    filters = [
        Provider.status == "verified",
        func.ST_DWithin(Provider.location, search_point, radius_m),
    ]
    if category_id is not None:
        filters.append(Provider.category_id.in_(category_with_children_ids(db, category_id)))
    if name_contains is not None and name_contains.strip():
        # Case-insensitive "name contains this text".
        # autoescape=True matters: in SQL's LIKE, % and _ are wildcards, so
        # without it a search for "%" would match every provider. With it,
        # whatever the user typed is matched literally.
        filters.append(Provider.name.icontains(name_contains.strip(), autoescape=True))

    # 2. Distance in metres (the column is GEOGRAPHY, so no unit conversion).
    distance_m = func.ST_Distance(Provider.location, search_point)

    # 3. Ordering: featured first, then weighted rating, then nearest.
    is_featured = case((Provider.featured_until >= today, 1), else_=0)
    weighted_rating = (
        Provider.review_count * Provider.avg_rating + PRIOR_REVIEW_COUNT * PRIOR_RATING
    ) / (Provider.review_count + PRIOR_REVIEW_COUNT)

    query = (
        select(Provider, distance_m)
        .where(*filters)
        .order_by(
            is_featured.desc(),
            weighted_rating.desc(),
            distance_m.asc(),
            Provider.id,  # final tie-break so paging is stable
        )
        .limit(limit)
        .offset(offset)
    )
    rows = [(provider, distance) for provider, distance in db.execute(query)]

    total = db.scalar(select(func.count()).select_from(Provider).where(*filters))
    return rows, total or 0


def distance_to_provider(db: Session, provider_id: uuid.UUID, lat: float, lng: float) -> float:
    """Distance in metres from (lat, lng) to one provider."""
    query = select(func.ST_Distance(Provider.location, point_for_query(lat, lng))).where(
        Provider.id == provider_id
    )
    return db.scalar(query)
