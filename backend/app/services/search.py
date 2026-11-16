"""Radius search. Implements the "Search query" section of docs/SCHEMA.md."""

import uuid
from datetime import date, datetime

from sqlalchemy import and_, case, func, or_, select, text
from sqlalchemy.orm import Session

from app.models import PUBLIC_STATUSES, Category, Provider
from app.services.geo import point_for_query
from app.services.opening_hours import beirut_day_and_time

# Ranking, in this order (each rule only decides between providers that are
# equal on all the rules before it):
#   1. Verified before not verified. Non-verified providers ('unverified' and
#      'pending') are only in the results when the searcher switched on
#      "include unverified", and then they ALL come after the verified ones.
#   2. Featured first. Only counts for verified providers: a featured date on
#      a non-verified provider is ignored.
#   3. Weighted rating, best first (explained just below).
#   4. Distance, nearest first.
#   5. Id, so two requests for the same page always agree.
#
# Weighted rating: pretend every provider also has 5 extra reviews of 3.5
# stars. A provider with one 5-star review then scores about 3.75, while one
# with fifty 4.8-star reviews scores about 4.68, so a single lucky review
# cannot outrank a long good record.
PRIOR_REVIEW_COUNT = 5
PRIOR_RATING = 3.5

# The `sort` choices (docs/API.md):
#   best     - the ranking above
#   distance - verified first, then nearest first
#   price    - cheapest structured price first, then the ranking above
SORT_CHOICES = ("best", "distance", "price")

# "Open now" in SQL. For today's day key (e.g. 'mon') it looks at each
# [open, close] pair in the provider's opening_hours and keeps the provider
# if the Beirut clock time is inside one of them. Same rule as
# services/opening_hours.py: open from the opening minute up to, but not
# including, the closing minute. A provider with no hours (NULL) has no
# pairs (jsonb_array_elements of NULL gives no rows), so it is left out.
# COLLATE "C" makes the "HH:MM" texts compare character by character,
# whatever the database's language settings.
OPEN_NOW_SQL = """
EXISTS (
    SELECT 1
    FROM jsonb_array_elements(providers.opening_hours -> :open_day) AS r(hours)
    WHERE (r.hours ->> 0) COLLATE "C" <= :open_time
      AND :open_time < (r.hours ->> 1) COLLATE "C"
)
"""


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
    category_ids: list[int] | None = None,
    name_contains: str | None = None,
    include_unverified: bool = False,
    max_price: float | None = None,
    price_unit: str | None = None,
    price_currency: str = "USD",
    open_now: bool = False,
    now: datetime | None = None,
    sort: str = "best",
    limit: int = 30,
    offset: int = 0,
) -> tuple[list[tuple[Provider, float]], int]:
    """Return (rows, total). Each row is (provider, distance in metres).

    `total` counts every match, ignoring limit and offset, so the app knows
    whether there are more pages.

    category_id is one category (with its children); category_ids is a list
    of them (used by the assistant, which may pick two or three). Both may
    be combined: a provider matching any of them is kept.
    max_price keeps providers whose structured price in that unit and
    currency is at most max_price (it needs price_unit). open_now needs
    `now`, the current moment, which is turned into Beirut time.
    """
    search_point = point_for_query(lat, lng)

    # 1. Filter: providers inside the circle. Verified ones only, unless the
    #    searcher asked for unverified ones too ('rejected' never matches).
    #    ST_DWithin can use the GIST index on providers.location.
    if include_unverified:
        status_filter = Provider.status.in_(PUBLIC_STATUSES)
    else:
        status_filter = Provider.status == "verified"
    filters = [
        status_filter,
        func.ST_DWithin(Provider.location, search_point, radius_m),
    ]
    wanted_categories = list(category_ids or [])
    if category_id is not None:
        wanted_categories.append(category_id)
    if category_id is not None or category_ids is not None:
        ids = set()
        for one_id in wanted_categories:
            ids.update(category_with_children_ids(db, one_id))
        # An empty set matches nothing, which is right for unknown ids.
        filters.append(Provider.category_id.in_(ids))
    if name_contains is not None and name_contains.strip():
        # Case-insensitive "name contains this text".
        # autoescape=True matters: in SQL's LIKE, % and _ are wildcards, so
        # without it a search for "%" would match every provider. With it,
        # whatever the user typed is matched literally.
        filters.append(Provider.name.icontains(name_contains.strip(), autoescape=True))
    if max_price is not None:
        # Providers without a structured price (NULL) never pass these tests,
        # so they are left out, as docs/API.md says.
        filters.append(Provider.price_amount <= max_price)
        filters.append(Provider.price_unit == price_unit)
        filters.append(Provider.price_currency == price_currency)
    if open_now:
        open_day, open_time = beirut_day_and_time(now)
        filters.append(text(OPEN_NOW_SQL).bindparams(open_day=open_day, open_time=open_time))

    # 2. Distance in metres (the column is GEOGRAPHY, so no unit conversion).
    distance_m = func.ST_Distance(Provider.location, search_point)

    # 3. Ordering: see "Ranking" at the top of this file.
    is_verified = case((Provider.status == "verified", 1), else_=0)
    is_featured = case(
        (and_(Provider.status == "verified", Provider.featured_until >= today), 1), else_=0
    )
    weighted_rating = (
        Provider.review_count * Provider.avg_rating + PRIOR_REVIEW_COUNT * PRIOR_RATING
    ) / (Provider.review_count + PRIOR_REVIEW_COUNT)

    best_order = [
        is_verified.desc(),
        is_featured.desc(),
        weighted_rating.desc(),
        distance_m.asc(),
        Provider.id,  # final tie-break so paging is stable
    ]
    if sort == "distance":
        order = [is_verified.desc(), distance_m.asc(), Provider.id]
    elif sort == "price":
        # Providers without a structured price go last.
        order = [Provider.price_amount.asc().nulls_last(), *best_order]
    else:
        order = best_order

    query = (
        select(Provider, distance_m).where(*filters).order_by(*order).limit(limit).offset(offset)
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
