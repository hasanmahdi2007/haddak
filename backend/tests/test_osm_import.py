"""OpenStreetMap import: tag mapping, phones, hours (no network), and the upsert."""

import importlib.util
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models import Provider
from app.services.osm_import import (
    build_query,
    category_slug,
    element_to_listing,
    nearest_place_name,
    normalize_phone,
    parse_opening_hours,
    parse_overpass,
)
from tests.conftest import make_category

KNOWN = {
    "pharmacy",
    "doctors",
    "dentist",
    "dermatologist",
    "mechanic",
    "hair-salon",
    "barber",
    "phone-repair",
    "laptop-repair",
    "tech-repair",
    "electrician",
    "candy-shop",
}

# A trimmed real-looking Overpass answer.
SAMPLE = {
    "elements": [
        {
            "type": "node",
            "id": 1,
            "lat": 33.89,
            "lon": 35.48,
            "tags": {
                "amenity": "pharmacy",
                "name": "Pharmacie Hamra",
                "phone": "01 345 678",
                "opening_hours": "Mo-Sa 08:00-22:00; Su off",
                "addr:suburb": "Hamra",
            },
        },
        {
            "type": "way",
            "id": 2,
            "center": {"lat": 33.88, "lon": 35.51},
            "tags": {
                "amenity": "clinic",
                "name": "Skin Clinic",
                "healthcare:speciality": "dermatology",
            },
        },
        {
            "type": "node",
            "id": 3,
            "lat": 33.87,
            "lon": 35.50,
            "tags": {"shop": "bakery", "name": "Furn"},
        },  # no category
        {
            "type": "node",
            "id": 4,
            "lat": 33.87,
            "lon": 35.50,
            "tags": {"amenity": "pharmacy"},
        },  # no name
        {
            "type": "node",
            "id": 5,
            "lat": 33.86,
            "lon": 35.52,
            "tags": {
                "craft": "car_repair",
                "name": "Garage Abou Ali",
                "contact:whatsapp": "+961 70 123 456",
            },
        },
        {
            "type": "node",
            "id": 6,
            "lat": 33.86,
            "lon": 35.52,
            "tags": {"shop": "hairdresser", "hairdresser": "barber", "name": "Salon Rami"},
        },
        {
            "type": "node",
            "id": 1,
            "lat": 33.89,
            "lon": 35.48,  # duplicate
            "tags": {"amenity": "pharmacy", "name": "Pharmacie Hamra"},
        },
    ]
}


def test_parse_overpass_maps_tags_and_skips_the_rest():
    listings = {x.osm_ref: x for x in parse_overpass(SAMPLE, KNOWN)}

    assert set(listings) == {"node/1", "way/2", "node/5", "node/6"}
    pharmacy = listings["node/1"]
    assert pharmacy.category_slug == "pharmacy"
    assert pharmacy.phone == "+9611345678"
    assert pharmacy.area_name == "Hamra"
    assert pharmacy.opening_hours == {
        day: [["08:00", "22:00"]] for day in ("mon", "tue", "wed", "thu", "fri", "sat")
    }
    clinic = listings["way/2"]
    assert (clinic.category_slug, clinic.lat, clinic.lng) == ("dermatologist", 33.88, 35.51)
    assert clinic.phone is None and clinic.area_name is None
    garage = listings["node/5"]
    assert garage.category_slug == "mechanic"
    assert (garage.phone, garage.whatsapp) == ("+96170123456", None)  # WhatsApp only = phone
    assert listings["node/6"].category_slug == "barber"


def test_unknown_slugs_are_never_used():
    tags = {"amenity": "clinic", "healthcare:speciality": "dermatology"}
    assert category_slug(tags, {"doctors"}) == "doctors"  # child missing: the parent
    assert category_slug(tags, {"pharmacy"}) is None
    assert category_slug({"shop": "hardware"}, KNOWN) is None


def test_element_without_position_is_skipped():
    element = {"type": "way", "id": 9, "tags": {"amenity": "pharmacy", "name": "X"}}
    assert element_to_listing(element, KNOWN) is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+961 1 234 567", "+9611234567"),
        ("01/234567", "+9611234567"),
        ("03-123456", "+9613123456"),
        ("00961 70 123 456", "+96170123456"),
        ("70123456", "+96170123456"),
        ("+961 03 123 456", "+9613123456"),
        ("961 71 123 456", "+96171123456"),
        ("+961 1 234 567; +961 3 123 456", "+9611234567"),
        ("+33 1 23 45 67 89", "+33123456789"),
        ("123", None),
        ("+961 12", None),
        ("", None),
        (None, None),
    ],
)
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (
            "24/7",
            {d: [["00:00", "23:59"]] for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")},
        ),
        (
            "Mo-Fr 08:00-13:00, 15:00-19:00; Sa 09:00-12:00",
            {
                **{
                    d: [["08:00", "13:00"], ["15:00", "19:00"]]
                    for d in ("mon", "tue", "wed", "thu", "fri")
                },
                "sat": [["09:00", "12:00"]],
            },
        ),
        (
            "08:00-20:00",
            {d: [["08:00", "20:00"]] for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")},
        ),
        ("Mo,We 9:00-24:00", {"mon": [["09:00", "23:59"]], "wed": [["09:00", "23:59"]]}),
        (
            "Mo-Sa 08:00-20:00; Th off",
            {d: [["08:00", "20:00"]] for d in ("mon", "tue", "wed", "fri", "sat")},
        ),
        # Too complex or overnight: left out, never guessed.
        ("Mo-Fr 18:00-02:00", None),
        ("Mo-Sa 08:00-20:00; PH off", None),
        ("Mo-Fr 08:00-12:00 open", None),
        ("sunrise-sunset", None),
        ("Su off", None),
        (None, None),
    ],
)
def test_parse_opening_hours(raw, expected):
    assert parse_opening_hours(raw) == expected


def test_build_query_is_one_bounded_query_for_named_places():
    query = build_query((33.8, 35.45, 33.93, 35.6), timeout_s=180)
    assert query.startswith("[out:json][timeout:180];")
    assert '["amenity"="pharmacy"]["name"](33.8,35.45,33.93,35.6);' in query
    assert query.endswith("out center tags;")


def test_nearest_place_name():
    places = [("Hamra", 33.896, 35.482), ("Achrafieh", 33.887, 35.52)]
    assert nearest_place_name(33.89, 35.515, places) == "Achrafieh"
    assert nearest_place_name(33.89, 35.515, []) is None


# ---------- saving (the script's upsert) ----------


def load_script():
    path = Path(__file__).resolve().parent.parent / "scripts" / "import_osm.py"
    spec = importlib.util.spec_from_file_location("import_osm", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_save_listings_inserts_then_updates_and_leaves_claimed_alone(db):
    script = load_script()
    ids = {
        slug: make_category(db, slug).id
        for slug in ("pharmacy", "dermatologist", "mechanic", "barber")
    }
    listings = parse_overpass(SAMPLE, set(ids))

    outcome = script.save_listings(db, listings, ids)
    db.commit()

    assert outcome["inserted"] == 4
    rows = {p.osm_ref: p for p in db.scalars(select(Provider))}
    pharmacy = rows["node/1"]
    assert (pharmacy.source, pharmacy.status, pharmacy.owner_user_id) == ("osm", "unverified", None)
    assert pharmacy.photos == []
    assert rows["way/2"].phone is None
    assert rows["way/2"].area_name  # nearest place from the places table

    # The founder rejects one, an owner claims another; then the import runs again.
    pharmacy.status = "rejected"
    rows["node/5"].owner_user_id = uuid.uuid4()
    rows["node/5"].name = "Owner's own name"
    db.commit()
    outcome = script.save_listings(db, parse_overpass(SAMPLE, set(ids)), ids)
    db.commit()

    assert (outcome["inserted"], outcome["updated"], outcome["skipped_claimed"]) == (0, 3, 1)
    db.expire_all()
    assert db.get(Provider, pharmacy.id).status == "rejected"
    assert db.get(Provider, rows["node/5"].id).name == "Owner's own name"
