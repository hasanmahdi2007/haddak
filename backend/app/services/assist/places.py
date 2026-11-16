"""Finds a place name ("Jounieh", "jouneih", "الحمرا") in the places table.

1. Exact match first: the normalised text equals the English name, the
   Arabic name or one of the aliases.
2. Otherwise fuzzy match with pg_trgm: `similarity()` compares the
   three-letter pieces of two texts and gives 0 (nothing alike) to 1 (equal).
   The best place above SIMILARITY_THRESHOLD wins.

Returns a list:
  []          nothing found
  [place]     found
  [p1, p2..]  the same name in different districts (e.g. two towns called
              "Jdeideh"); the app lets the user choose.
"""

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Place
from app.services.assist.normalize import normalize_text

# Below this, two names are too different to be the same place. Chosen by
# trying misspellings ("jouneih" scores 0.36 against "Jounieh", "tripoly"
# 0.6 against "Tripoli") and unrelated words ("market", "garage": no match).
SIMILARITY_THRESHOLD = 0.35

# normalize_name() is the SQL twin of normalize_text() (migration 0006).
EXACT_MATCH_SQL = text(
    """
    normalize_name(places.name_en) = :name
    OR normalize_name(places.name_ar) = :name
    OR EXISTS (SELECT 1 FROM unnest(places.aliases) AS a(alias)
               WHERE normalize_name(a.alias) = :name)
    """
)

# Every place scored by the best similarity between the text and any of its
# names; the best few above the threshold, best first.
# With ~80 rows Postgres simply scores them all. The trigram index on
# normalize_name(name_en) is there for the much longer GeoNames list, where
# a `normalize_name(name_en) % :name` pre-filter can use it.
FUZZY_MATCH_SQL = text(
    """
    SELECT id, score FROM (
        SELECT places.id,
               GREATEST(
                   similarity(normalize_name(places.name_en), :name),
                   similarity(normalize_name(places.name_ar), :name),
                   COALESCE((SELECT max(similarity(normalize_name(a.alias), :name))
                             FROM unnest(places.aliases) AS a(alias)), 0)
               ) AS score
        FROM places
    ) AS scored
    WHERE score >= :threshold
    ORDER BY score DESC, id
    LIMIT 5
    """
)


def find_place(db: Session, name: str) -> list[Place]:
    normalized = normalize_text(name)
    if len(normalized) < 2:
        return []

    exact = list(
        db.scalars(
            select(Place).where(EXACT_MATCH_SQL.bindparams(name=normalized)).order_by(Place.id)
        )
    )
    if exact:
        return same_name_only(exact)

    rows = db.execute(
        FUZZY_MATCH_SQL, {"name": normalized, "threshold": SIMILARITY_THRESHOLD}
    ).all()
    return same_name_only([db.get(Place, row.id) for row in rows])


def same_name_only(places: list[Place]) -> list[Place]:
    """Keep the first place and any other place with the same English name.

    "Several places" must mean "same name, different districts". Two
    different names that both matched (e.g. a fuzzy match on a nearby
    spelling) are not a real choice for the user: the first one wins.
    """
    if not places:
        return []
    first = places[0]
    return [p for p in places if p.name_en.lower() == first.name_en.lower()]


def place_by_slug(db: Session, slug: str) -> Place | None:
    return db.scalar(select(Place).where(Place.slug == slug))
