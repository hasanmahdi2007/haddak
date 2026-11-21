"""Import shops and practices from OpenStreetMap as unverified, unclaimed listings.

    python scripts/import_osm.py --dry-run              # counts per category, writes nothing
    python scripts/import_osm.py                        # Greater Beirut, into DATABASE_URL
    python scripts/import_osm.py --bbox 33.05,35.10,34.70,36.65 --limit 500   # all of Lebanon

One Overpass request per run (be polite: it is a free public service).
Running it again updates the same rows (matched by osm_ref) instead of adding
them twice. Listings someone has claimed are never touched, and a listing's
status is never changed (a listing the founder rejected stays rejected).

Licence: the data is ODbL. The app shows "Data © OpenStreetMap contributors"
on these profiles; if our database is ever shared, this part stays ODbL.
The mapping rules live in app/services/osm_import.py.
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

# Allow `python scripts/import_osm.py` to import the `app` package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import Category, Place, Provider  # noqa: E402
from app.routers.me import random_slug  # noqa: E402
from app.services.geo import point_for_storage  # noqa: E402
from app.services.osm_import import (  # noqa: E402
    GREATER_BEIRUT_BBOX,
    OsmListing,
    build_query,
    nearest_place_name,
    parse_overpass,
)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# A clear name and nothing personal, as Overpass asks of automated clients.
USER_AGENT = "Haddak-importer/0.1"
QUERY_TIMEOUT_S = 180
FALLBACK_AREA = "Lebanon"  # only if the places table is empty


def parse_bbox(text: str) -> tuple[float, float, float, float]:
    parts = [float(x) for x in text.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox is south,west,north,east")
    return parts[0], parts[1], parts[2], parts[3]


def fetch_overpass(query: str) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode()
    request = urllib.request.Request(
        OVERPASS_URL, data=data, headers={"User-Agent": USER_AGENT}, method="POST"
    )
    # Give the server its full query time plus a margin before giving up.
    with urllib.request.urlopen(request, timeout=QUERY_TIMEOUT_S + 30) as response:
        return json.load(response)


def save_listings(db: Session, listings: list[OsmListing], category_ids: dict[str, int]) -> Counter:
    """Insert new listings and update unclaimed ones. Returns what happened.

    Everything is read up front and written in one flush at the end: the
    hosted database is far away, so one round trip per listing would turn
    an import of a few thousand shops into a long, fragile run."""
    outcome: Counter = Counter()
    places = [(p.name_en, p.lat, p.lng) for p in db.scalars(select(Place))]
    taken_slugs = set(db.scalars(select(Provider.slug)))

    def unused_slug() -> str:
        while True:
            slug = random_slug()
            if slug not in taken_slugs:
                taken_slugs.add(slug)
                return slug

    refs = [listing.osm_ref for listing in listings]
    existing = {
        p.osm_ref: p for p in db.scalars(select(Provider).where(Provider.osm_ref.in_(refs)))
    }

    for listing in listings:
        area = listing.area_name or nearest_place_name(listing.lat, listing.lng, places)
        fields = {
            "name": listing.name,
            "category_id": category_ids[listing.category_slug],
            "phone": listing.phone,
            "whatsapp": listing.whatsapp,
            "location": point_for_storage(listing.lat, listing.lng),
            "area_name": area or FALLBACK_AREA,
            "opening_hours": listing.opening_hours,
        }
        provider = existing.get(listing.osm_ref)
        if provider is None:
            provider = Provider(
                owner_user_id=None,
                source="osm",
                status="unverified",
                osm_ref=listing.osm_ref,
                slug=unused_slug(),
                photos=[],
                **fields,
            )
            db.add(provider)
            outcome["inserted"] += 1
        elif provider.owner_user_id is not None:
            # The owner keeps their own edits.
            outcome["skipped_claimed"] += 1
        else:
            for name, value in fields.items():
                setattr(provider, name, value)
            outcome["updated"] += 1
    db.flush()
    return outcome


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--bbox",
        type=parse_bbox,
        default=GREATER_BEIRUT_BBOX,
        help="south,west,north,east (default: Greater Beirut)",
    )
    parser.add_argument("--dry-run", action="store_true", help="count only, write nothing")
    parser.add_argument("--limit", type=int, default=None, help="import at most this many")
    parser.add_argument(
        "--from-file", type=Path, default=None, help="read a saved Overpass JSON answer instead"
    )
    parser.add_argument(
        "--save-file", type=Path, default=None, help="also save the Overpass answer here"
    )
    args = parser.parse_args()

    # Short database visits only: the Overpass request below can take minutes,
    # and holding a transaction open that long is refused in production
    # (idle_in_transaction_session_timeout).
    with SessionLocal() as db:
        category_ids = {slug: cid for cid, slug in db.execute(select(Category.id, Category.slug))}

    if args.from_file:
        payload = json.loads(args.from_file.read_text(encoding="utf-8"))
    else:
        print(f"Asking Overpass for bbox {args.bbox} ...")
        payload = fetch_overpass(build_query(args.bbox, QUERY_TIMEOUT_S))
        if args.save_file:
            args.save_file.write_text(json.dumps(payload), encoding="utf-8")

    listings = parse_overpass(payload, set(category_ids))
    print(f"{len(payload.get('elements', []))} OSM elements, {len(listings)} usable listings")
    if args.limit is not None:
        listings = listings[: args.limit]

    per_category = Counter(listing.category_slug for listing in listings)
    for slug, count in sorted(per_category.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {slug:22} {count}")
    print(
        f"  with phone: {sum(1 for x in listings if x.phone)}, "
        f"with hours: {sum(1 for x in listings if x.opening_hours)}, "
        f"with addr area: {sum(1 for x in listings if x.area_name)}"
    )

    if args.dry_run:
        print("Dry run: nothing written.")
        return

    with SessionLocal() as db:
        outcome = save_listings(db, listings, category_ids)
        db.commit()
    print(
        f"Done: {outcome['inserted']} inserted, {outcome['updated']} updated, "
        f"{outcome['skipped_claimed']} claimed (left alone)."
    )


if __name__ == "__main__":
    main()
