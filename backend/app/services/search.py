"""Radius search. Implements the "Search query" section of docs/SCHEMA.md."""

import threading
import uuid
from datetime import date, datetime

from sqlalchemy import and_, case, func, or_, select, text
from sqlalchemy.orm import Session

from app.models import PUBLIC_STATUSES, Category, Provider
from app.services.geo import point_for_query
from app.services.opening_hours import beirut_day_and_time

# Ranking, in this order (each rule only decides between providers that are
# equal on all the rules before it):
#   0. Only with a text search (q): providers whose NAME matches come first,
#      before those found through their category or area. Someone typing
#      "Ali Tech" wants Ali Tech, not every tech shop nearby.
#   1. Verified before not verified. Non-verified providers ('unverified' and
#      'pending') are only in the results when the searcher switched on
#      "include unverified", and then they ALL come after the verified ones.
#   1b. Among non-verified providers: those with a phone or WhatsApp number
#      before those with neither (OpenStreetMap listings often have no
#      number, and a listing you cannot call is less useful).
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
#   distance - rules 0, 1 and 1b above, then nearest first
#   price    - cheapest structured price first, then the ranking above
SORT_CHOICES = ("best", "distance", "price")

# Text search (q): a category also matches when its English or Arabic name is
# SIMILAR to q (pg_trgm's similarity(): 0 = nothing alike, 1 = equal), so a
# typo like "plumbr" still finds plumbers (similarity 0.5 to "plumber").
CATEGORY_SIMILARITY_THRESHOLD = 0.4

# Categories whose name or one of whose aliases CONTAINS the search text, or
# whose name is similar to it. :q is already normalised and :pattern is
# '%' + q + '%' with q LIKE-escaped (escape character: backslash), so a "%"
# or "_" typed by the user is matched literally. similarity() comes from
# pg_trgm (migration 0006); the categories table is small (about 150 rows),
# so scoring every row is cheap.
MATCHING_CATEGORIES_SQL = text(
    r"""
    SELECT id FROM categories
    WHERE normalize_name(name_en) LIKE :pattern ESCAPE '\'
       OR normalize_name(name_ar) LIKE :pattern ESCAPE '\'
       OR EXISTS (SELECT 1 FROM unnest(aliases) AS a(alias)
                  WHERE normalize_name(a.alias) LIKE :pattern ESCAPE '\')
       OR similarity(normalize_name(name_en), :q) >= :threshold
       OR similarity(normalize_name(name_ar), :q) >= :threshold
    """
)

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


# ---------- the category tree, kept in memory ----------
# Categories change only through a migration, and a migration only runs
# before a new process starts (deploy or restart). So the tree is read from
# the database once per process, on the first search that needs it, instead
# of once per search. The cache starts empty in every new process.
#
# {category id: ids of its direct children}. Every known category is a key.
_category_children: dict[int, list[int]] | None = None
# Several requests run at the same time (in threads): only one loads.
_category_cache_lock = threading.Lock()


def clear_category_cache() -> None:
    """Forget the tree; the next search reads it again (used by the tests,
    which create and delete categories all the time)."""
    global _category_children
    with _category_cache_lock:
        _category_children = None


def category_children(db: Session, *, reload: bool = False) -> dict[int, list[int]]:
    global _category_children
    with _category_cache_lock:
        if _category_children is None or reload:
            children: dict[int, list[int]] = {}
            rows = db.execute(select(Category.id, Category.parent_id).order_by(Category.id)).all()
            for category_id, _parent_id in rows:
                children[category_id] = []
            for category_id, parent_id in rows:
                if parent_id is not None and parent_id in children:
                    children[parent_id].append(category_id)
            _category_children = children
        return _category_children


def categories_with_children_ids(db: Session, category_ids: list[int]) -> list[int]:
    """These categories' own ids plus the ids of their direct children.
    Unknown ids are left out."""
    if not category_ids:
        return []
    children = category_children(db)
    if any(category_id not in children for category_id in category_ids):
        # An id we have not seen: during a deploy, the new version's
        # migration may have added it while this process was running.
        # Read the tree again once (as cheap as the old per-search query).
        children = category_children(db, reload=True)
    ids: list[int] = []
    for category_id in category_ids:
        if category_id in children:
            ids.append(category_id)
            ids.extend(children[category_id])
    return ids


def normalized_search_text(db: Session, q: str | None) -> str | None:
    """The search text after normalize_name() (lower case, one form of each
    Arabic letter, no accents), or None when there is nothing to search for.

    The database does it, so it is exactly the rule used on the columns.
    """
    if q is None or not q.strip():
        return None
    normalized = db.scalar(select(func.normalize_name(q.strip())))
    # normalize_name() deletes the Arabic stretching character, so a q made
    # only of those becomes empty; an empty text would "match" everything.
    return normalized or None


def escape_like(value: str) -> str:
    """Make LIKE treat %, _ and the backslash itself as plain text."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def text_search_category_ids(db: Session, normalized_q: str) -> list[int]:
    """Categories matching the search text, plus every child of a matching
    group: "doctors" (or "أطباء") also finds dentists and pharmacies."""
    params = {
        "pattern": f"%{escape_like(normalized_q)}%",
        "q": normalized_q,
        "threshold": CATEGORY_SIMILARITY_THRESHOLD,
    }
    matching = list(db.scalars(MATCHING_CATEGORIES_SQL, params))
    return categories_with_children_ids(db, matching)


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
    text_query: str | None = None,
    include_unverified: bool = False,
    max_price: float | None = None,
    price_unit: str | None = None,
    price_currency: str = "USD",
    open_now: bool = False,
    available_now: bool = False,
    now: datetime | None = None,
    sort: str = "best",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[tuple[Provider, float]], int]:
    """Return (rows, total). Each row is (provider, distance in metres).

    `total` counts every match, ignoring limit and offset, so the app knows
    whether there are more pages.

    category_id is one category (with its children); category_ids is a list
    of them (used by the assistant, which may pick two or three). Both may
    be combined: a provider matching any of them is kept.
    name_contains keeps providers whose name contains the text (used by the
    assistant). text_query is the app's search box (q in docs/API.md): the
    name, the category (or its group) or the area may match, and name
    matches are ranked first.
    max_price keeps providers whose structured price in that unit and
    currency is at most max_price (it needs price_unit). open_now and
    available_now need `now`, the current moment (open_now turns it into
    Beirut time). open_now also keeps providers marked "Available now".
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
        ids = set(categories_with_children_ids(db, wanted_categories))
        # An empty set matches nothing, which is right for unknown ids.
        filters.append(Provider.category_id.in_(ids))
    if name_contains is not None and name_contains.strip():
        # Case-insensitive "name contains this text".
        # autoescape=True matters: in SQL's LIKE, % and _ are wildcards, so
        # without it a search for "%" would match every provider. With it,
        # whatever the user typed is matched literally.
        filters.append(Provider.name.icontains(name_contains.strip(), autoescape=True))
    # Text search: name OR category OR area. Both sides go through
    # normalize_name(), so "Achrafié" finds "achrafie" and Arabic letter forms
    # (أ / ا, ة / ه) do not matter.
    normalized_q = normalized_search_text(db, text_query)
    name_matches = None
    if normalized_q is not None:
        # autoescape=True: % and _ typed by the user are plain text, not
        # LIKE wildcards (as in name_contains above).
        name_matches = func.normalize_name(Provider.name).contains(normalized_q, autoescape=True)
        area_matches = func.normalize_name(Provider.area_name).contains(
            normalized_q, autoescape=True
        )
        matching_categories = text_search_category_ids(db, normalized_q)
        filters.append(
            or_(name_matches, Provider.category_id.in_(matching_categories), area_matches)
        )
    if max_price is not None:
        # Providers without a structured price (NULL) never pass these tests,
        # so they are left out, as docs/API.md says.
        filters.append(Provider.price_amount <= max_price)
        filters.append(Provider.price_unit == price_unit)
        filters.append(Provider.price_currency == price_currency)
    if open_now:
        # Open by the hours, OR marked "Available now" (people without fixed
        # hours who can come right away count as open).
        open_day, open_time = beirut_day_and_time(now)
        open_by_hours = text(OPEN_NOW_SQL).bindparams(open_day=open_day, open_time=open_time)
        filters.append(or_(open_by_hours, Provider.available_until > now))
    if available_now:
        filters.append(Provider.available_until > now)

    # 2. Distance in metres (the column is GEOGRAPHY, so no unit conversion).
    distance_m = func.ST_Distance(Provider.location, search_point)

    # 3. Ordering: see "Ranking" at the top of this file.
    is_verified = case((Provider.status == "verified", 1), else_=0)
    # Rule 1b: 1 for verified providers (they always have a phone) and for
    # non-verified ones with a phone or WhatsApp number; 0 for the rest.
    has_contact = case(
        (Provider.status == "verified", 1),
        (or_(Provider.phone.is_not(None), Provider.whatsapp.is_not(None)), 1),
        else_=0,
    )
    is_featured = case(
        (and_(Provider.status == "verified", Provider.featured_until >= today), 1), else_=0
    )
    weighted_rating = (
        Provider.review_count * Provider.avg_rating + PRIOR_REVIEW_COUNT * PRIOR_RATING
    ) / (Provider.review_count + PRIOR_REVIEW_COUNT)

    # Rule 0 (name matches first) only exists when there is a text search.
    name_first = []
    if name_matches is not None:
        name_first = [case((name_matches, 1), else_=0).desc()]

    best_order = [
        *name_first,
        is_verified.desc(),
        has_contact.desc(),
        is_featured.desc(),
        weighted_rating.desc(),
        distance_m.asc(),
        Provider.id,  # final tie-break so paging is stable
    ]
    if sort == "distance":
        order = [*name_first, is_verified.desc(), has_contact.desc(), distance_m.asc(), Provider.id]
    elif sort == "price":
        # Providers without a structured price go last.
        order = [Provider.price_amount.asc().nulls_last(), *best_order]
    else:
        order = best_order

    # count(*) OVER () adds the number of ALL matches (before limit and
    # offset) to every returned row, so one query gives both the page and
    # the total; a separate count would run the whole filter a second time.
    total_matches = func.count().over()
    query = (
        select(Provider, distance_m, total_matches)
        .where(*filters)
        .order_by(*order)
        .limit(limit)
        .offset(offset)
    )
    result = db.execute(query).all()
    rows = [(provider, distance) for provider, distance, _total in result]
    if result:
        total = result[0][2]
    elif offset == 0:
        total = 0  # nothing matches at all
    else:
        # A page past the end has no rows to carry the total: count separately.
        total = db.scalar(select(func.count()).select_from(Provider).where(*filters)) or 0
    return rows, total


def distance_to_provider(db: Session, provider_id: uuid.UUID, lat: float, lng: float) -> float:
    """Distance in metres from (lat, lng) to one provider."""
    query = select(func.ST_Distance(Provider.location, point_for_query(lat, lng))).where(
        Provider.id == provider_id
    )
    return db.scalar(query)
