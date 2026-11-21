"""OpenStreetMap import: the pure part (no network, no database).

scripts/import_osm.py downloads places from the Overpass API and stores
them; everything here turns one Overpass element into one listing, so it
can be unit-tested with sample JSON. Rules: "OpenStreetMap import" in
docs/SCHEMA.md.

Licence: OpenStreetMap data is ODbL. It is shown with "Data © OpenStreetMap
contributors", and a shared copy of our database would have to stay ODbL.
"""

import math
import re
from dataclasses import dataclass

from app.schemas import PHONE_PATTERN

# (OSM key, OSM value, our category slug). Each rule becomes one line of the
# Overpass query, and an element takes the slug of the FIRST rule it matches.
# A slug that is not in the categories table is skipped: the import never
# invents categories. Left out on purpose because we have no fitting
# category: shop=bakery (bread and man'oushe are not sweets), shop=hardware,
# shop=doityourself, shop=car_parts, amenity=driving_school.
TAG_RULES: list[tuple[str, str, str]] = [
    ("amenity", "pharmacy", "pharmacy"),
    ("healthcare", "pharmacy", "pharmacy"),
    ("amenity", "dentist", "dentist"),
    ("healthcare", "dentist", "dentist"),
    ("amenity", "doctors", "doctors"),
    ("amenity", "clinic", "doctors"),
    ("healthcare", "doctor", "doctors"),
    ("shop", "pastry", "sweets-shops"),
    ("shop", "confectionery", "candy-shop"),
    ("shop", "chocolate", "candy-shop"),
    ("shop", "cake", "cake-shop"),
    ("shop", "car_repair", "mechanic"),
    ("craft", "car_repair", "mechanic"),
    ("amenity", "car_wash", "car-wash"),
    ("shop", "mobile_phone", "phone-repair"),
    ("shop", "computer", "laptop-repair"),
    ("shop", "electronics", "tech-repair"),
    ("craft", "electronics_repair", "tech-repair"),
    ("craft", "electrician", "electrician"),
    ("craft", "plumber", "plumber"),
    ("craft", "hvac", "ac-repair"),
    ("craft", "carpenter", "carpenter"),
    ("craft", "painter", "painter"),
    ("craft", "photovoltaic", "solar"),
    ("shop", "hairdresser", "hair-salon"),
    ("shop", "beauty", "beauty"),
    ("shop", "tailor", "tailor"),
    ("craft", "tailor", "tailor"),
    ("craft", "dressmaker", "tailor"),
    ("craft", "shoemaker", "shoe-repair"),
    ("shop", "shoe_repair", "shoe-repair"),
    ("craft", "photographer", "photographer"),
    ("leisure", "fitness_centre", "fitness"),
    ("amenity", "music_school", "music-lessons"),
]

# A more precise category from a second tag, when that category exists.
# healthcare:speciality=dermatology on a clinic -> dermatologist, and so on.
SPECIALITY_SLUGS = {
    "dermatology": "dermatologist",
    "paediatrics": "pediatrician",
    "pediatrics": "pediatrician",
    "general": "general-practitioner",
    "dentistry": "dentist",
}

# Area name: the most local addr:* tag that is filled in.
AREA_TAGS = ["addr:neighbourhood", "addr:quarter", "addr:suburb", "addr:place", "addr:city"]

# Default bounding box: Greater Beirut (south, west, north, east).
GREATER_BEIRUT_BBOX = (33.80, 35.45, 33.93, 35.60)

MAX_NAME_LENGTH = 100  # same limit as a profile's name


@dataclass
class OsmListing:
    osm_ref: str  # 'node/123' or 'way/456'
    name: str
    category_slug: str
    lat: float
    lng: float
    phone: str | None
    whatsapp: str | None
    opening_hours: dict | None
    area_name: str | None  # None: the script uses the nearest place instead


def build_query(bbox: tuple[float, float, float, float], timeout_s: int = 180) -> str:
    """One Overpass query for every rule, named places only.

    `nwr` = nodes, ways and relations. `out center tags` returns a centre
    point for ways and relations (a building outline), which is all we need.
    """
    south, west, north, east = bbox
    box = f"{south},{west},{north},{east}"
    lines = [f'  nwr["{key}"="{value}"]["name"]({box});' for key, value, _ in TAG_RULES]
    return f"[out:json][timeout:{timeout_s}];\n(\n" + "\n".join(lines) + "\n);\nout center tags;"


def category_slug(tags: dict[str, str], known_slugs: set[str]) -> str | None:
    """Our category for these OSM tags, or None if nothing fits."""
    for key, value, slug in TAG_RULES:
        if tags.get(key) != value:
            continue
        refined = refine_slug(slug, tags)
        if refined in known_slugs:
            return refined
        if slug in known_slugs:
            return slug
    return None


def refine_slug(slug: str, tags: dict[str, str]) -> str:
    """A child category when a second tag tells us more."""
    if slug == "doctors":
        # The tag may hold several values: 'dermatology;general'. Use the first.
        speciality = tags.get("healthcare:speciality", "").split(";")[0].strip()
        return SPECIALITY_SLUGS.get(speciality, slug)
    if slug == "hair-salon" and tags.get("hairdresser") in ("barber", "male"):
        return "barber"
    if slug == "beauty" and tags.get("beauty") == "nails":
        return "nail-salon"
    return slug


def normalize_phone(raw: str | None) -> str | None:
    """A Lebanese number in our format ('+96170123456'), or None.

    OSM numbers are typed by hand: '+961 1 234 567', '01/234567',
    '03-123456', '00961 70 123 456', '70123456'. Several numbers are
    separated by ';' or ','; the first one is used. Anything we cannot
    read with confidence is dropped (None) rather than guessed.
    """
    if not raw:
        return None
    first = re.split(r"[;,]", raw)[0]
    # Keep digits and a leading plus; spaces, dashes, dots, slashes go.
    digits = re.sub(r"\D", "", first)
    if first.strip().startswith("+"):
        number = "+" + digits
    elif digits.startswith("00"):
        number = "+" + digits[2:]
    elif digits.startswith("961") and len(digits) >= 10:
        number = "+" + digits
    elif digits.startswith("0"):
        number = "+961" + digits[1:]
    elif len(digits) in (7, 8):
        number = "+961" + digits
    else:
        return None

    if number.startswith("+961"):
        # Lebanese numbers have 7 digits (landlines, 03) or 8 (70, 71, 76, 81...)
        # after +961. A stray 0 after the country code is a common typo.
        national = number[4:].removeprefix("0")
        if len(national) not in (7, 8):
            return None
        number = "+961" + national
    return number if PHONE_PATTERN.match(number) else None


# ----- Opening hours -----
# Only the simple, common forms are read:
#   "24/7"
#   "Mo-Fr 08:00-18:00; Sa 09:00-13:00"
#   "Mo-Sa 08:00-13:00,15:00-19:00; Su off"
#   "08:00-20:00"                       (every day)
# Anything else (public holidays, months, sunrise, overnight ranges, more
# than 3 ranges a day) gives None: "hours not provided" is better than wrong.

OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
OUR_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
TIME_RANGE = re.compile(r"^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$")
MAX_RANGES_PER_DAY = 3


def parse_days(text: str) -> list[str] | None:
    """'Mo-Fr,Su' -> ['mon', ..., 'fri', 'sun']; None if not understood."""
    days: list[str] = []
    for part in text.split(","):
        part = part.strip()
        if "-" in part:
            start, _, end = part.partition("-")
            if start not in OSM_DAYS or end not in OSM_DAYS:
                return None
            i, j = OSM_DAYS.index(start), OSM_DAYS.index(end)
            if j < i:  # 'Sa-Mo' wraps over the week end
                indexes = list(range(i, 7)) + list(range(0, j + 1))
            else:
                indexes = list(range(i, j + 1))
            days.extend(OUR_DAYS[k] for k in indexes)
        elif part in OSM_DAYS:
            days.append(OUR_DAYS[OSM_DAYS.index(part)])
        else:
            return None
    return days


def parse_ranges(text: str) -> list[list[str]] | None:
    """'08:00-13:00,15:00-19:00' -> [['08:00', '13:00'], ['15:00', '19:00']]."""
    ranges = []
    for part in text.split(","):
        match = TIME_RANGE.match(part.strip())
        if not match:
            return None
        open_h, open_m, close_h, close_m = (int(x) for x in match.groups())
        if (close_h, close_m) == (24, 0):
            close_h, close_m = 23, 59  # our longest day ends at 23:59
        if open_h > 23 or close_h > 23 or open_m > 59 or close_m > 59:
            return None
        opening, closing = f"{open_h:02d}:{open_m:02d}", f"{close_h:02d}:{close_m:02d}"
        if opening >= closing:  # overnight ranges are not supported in v1
            return None
        ranges.append([opening, closing])
    if len(ranges) > MAX_RANGES_PER_DAY:
        return None
    return ranges


def parse_opening_hours(raw: str | None) -> dict | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw == "24/7":
        return {day: [["00:00", "23:59"]] for day in OUR_DAYS}
    hours: dict[str, list[list[str]]] = {}
    for rule in raw.split(";"):
        # "Mo, We 08:00-12:00, 15:00-18:00": drop the spaces after commas, so the
        # last space is the one between the days and the times.
        rule = re.sub(r",\s+", ",", rule.strip())
        if not rule:
            continue
        days_text, _, times_text = rule.rpartition(" ")
        if not days_text:
            # Only times: every day.
            days, times_text = list(OUR_DAYS), rule
        else:
            days = parse_days(days_text.strip())
            if days is None:
                return None
        if times_text.lower() in ("off", "closed"):
            ranges: list[list[str]] = []
        else:
            ranges = parse_ranges(times_text)
            if ranges is None:
                return None
        # Later rules win over earlier ones for the same day (OSM's rule).
        for day in days:
            hours[day] = ranges
    # A closed day is simply left out of our shape.
    result = {day: ranges for day, ranges in hours.items() if ranges}
    return result or None


def area_from_tags(tags: dict[str, str]) -> str | None:
    for key in AREA_TAGS:
        value = tags.get(key, "").strip()
        if value:
            return value[:MAX_NAME_LENGTH]
    return None


def element_to_listing(element: dict, known_slugs: set[str]) -> OsmListing | None:
    """One Overpass element -> one listing, or None when it should be skipped
    (no name, no position, or no category of ours fits)."""
    tags = element.get("tags") or {}
    name = (tags.get("name") or "").strip()
    if not name:
        return None
    slug = category_slug(tags, known_slugs)
    if slug is None:
        return None

    # Nodes have lat/lon; ways and relations have a "center" (out center).
    point = element if "lat" in element else element.get("center")
    if not point or "lat" not in point or "lon" not in point:
        return None

    phone = normalize_phone(tags.get("phone") or tags.get("contact:phone"))
    whatsapp = normalize_phone(tags.get("contact:whatsapp") or tags.get("whatsapp"))
    if phone is None:
        # Only a WhatsApp number: it is the phone too.
        phone, whatsapp = whatsapp, None
    if whatsapp == phone:
        whatsapp = None  # NULL means "same as phone"

    return OsmListing(
        osm_ref=f"{element['type']}/{element['id']}",
        name=name[:MAX_NAME_LENGTH],
        category_slug=slug,
        lat=float(point["lat"]),
        lng=float(point["lon"]),
        phone=phone,
        whatsapp=whatsapp,
        opening_hours=parse_opening_hours(tags.get("opening_hours")),
        area_name=area_from_tags(tags),
    )


def parse_overpass(payload: dict, known_slugs: set[str]) -> list[OsmListing]:
    """All usable listings in an Overpass JSON answer, without duplicates."""
    listings: dict[str, OsmListing] = {}
    for element in payload.get("elements", []):
        listing = element_to_listing(element, known_slugs)
        if listing is not None:
            # The same element twice (it matched two rules): keep the first.
            listings.setdefault(listing.osm_ref, listing)
    return list(listings.values())


def nearest_place_name(
    lat: float, lng: float, places: list[tuple[str, float, float]]
) -> str | None:
    """Name of the closest (name, lat, lng) place, or None if there are none.

    A flat-earth distance is plenty to pick the nearest of a few dozen towns.
    """
    best_name, best_distance = None, math.inf
    for name, place_lat, place_lng in places:
        dx = (place_lng - lng) * math.cos(math.radians(lat))
        dy = place_lat - lat
        distance = dx * dx + dy * dy
        if distance < best_distance:
            best_name, best_distance = name, distance
    return best_name
