"""Text search on GET /providers/search (q): name, category (with aliases and
typos) or area, name matches first. Rules: "Search query" in docs/SCHEMA.md."""

from datetime import date, timedelta

from app.models import Category
from tests.conftest import make_provider, search


def names(result: dict) -> list[str]:
    return [item["name"] for item in result["items"]]


def add_category(db, slug, name_en, name_ar, aliases=(), parent=None) -> Category:
    category = Category(
        slug=slug,
        name_en=name_en,
        name_ar=name_ar,
        icon="icon",
        parent_id=parent.id if parent else None,
        sort_order=0,
        aliases=list(aliases),
    )
    db.add(category)
    db.commit()
    return category


def home_repair_tree(db):
    """A small piece of the real tree: home repair with plumber and electrician,
    and an unrelated barber."""
    home = add_category(db, "home-repair", "Home repair", "صيانة منزلية", ["handyman", "صيانة"])
    plumber = add_category(
        db,
        "plumber",
        "Plumber",
        "سنكري",
        ["plumbing", "pipes", "سمكري", "sankari", "sankary", "تمديدات صحية"],
        parent=home,
    )
    electrician = add_category(
        db, "electrician", "Electrician", "كهربجي", ["kahrabji", "كهربائي"], parent=home
    )
    barber = add_category(db, "barber", "Barber", "حلاق رجالي", ["haircut", "حلاق"])
    return home, plumber, electrician, barber


def test_the_arabic_category_name_and_an_arabic_alias_find_plumbers(client, db):
    _, plumber, _, barber = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")
    make_provider(db, barber, "Salon Rami")

    assert names(search(client, q="سنكري")) == ["Abu Hassan"]
    assert names(search(client, q="سمكري")) == ["Abu Hassan"]


def test_english_name_and_arabizi_alias_find_plumbers(client, db):
    _, plumber, _, barber = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")
    make_provider(db, barber, "Salon Rami")

    assert names(search(client, q="plumber")) == ["Abu Hassan"]
    assert names(search(client, q="PLUMBING")) == ["Abu Hassan"]
    assert names(search(client, q="sankari")) == ["Abu Hassan"]
    assert names(search(client, q="sanka")) == ["Abu Hassan"]  # part of an alias


def test_a_typo_in_the_category_name_still_finds_it(client, db):
    _, plumber, electrician, barber = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")
    make_provider(db, electrician, "Karim")
    make_provider(db, barber, "Salon Rami")

    assert names(search(client, q="plumbr")) == ["Abu Hassan"]
    assert names(search(client, q="electrcian")) == ["Karim"]


def test_a_group_word_finds_every_child_category(client, db):
    home, plumber, electrician, barber = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan", distance_m=100)
    make_provider(db, electrician, "Karim", distance_m=200)
    make_provider(db, home, "Fix It All", distance_m=300)
    make_provider(db, barber, "Salon Rami")

    for q in ("home repair", "صيانة", "handyman"):
        result = search(client, q=q)
        assert names(result) == ["Abu Hassan", "Karim", "Fix It All"], q
        assert result["total"] == 3


def test_a_child_word_does_not_find_the_whole_group(client, db):
    _, plumber, electrician, _ = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")
    make_provider(db, electrician, "Karim")

    assert names(search(client, q="kahrabji")) == ["Karim"]


def test_the_area_name_matches(client, db):
    _, plumber, electrician, _ = home_repair_tree(db)
    abed = make_provider(db, plumber, "Abu Hassan")
    abed.area_name = "Bir el Abed"
    make_provider(db, electrician, "Karim")  # area: Haret Hreik
    db.commit()

    assert names(search(client, q="bir el abed")) == ["Abu Hassan"]
    assert names(search(client, q="HREIK")) == ["Karim"]


def test_nothing_matches_an_unrelated_word(client, db):
    _, plumber, _, _ = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")

    assert search(client, q="zzzz") == {"items": [], "total": 0}


def test_a_name_match_comes_before_a_better_category_match(client, db):
    _, plumber, _, barber = home_repair_tree(db)
    today = date.today()
    # Found through the category: featured, well rated and closer.
    make_provider(
        db,
        plumber,
        "Abu Hassan",
        distance_m=50,
        avg_rating=4.9,
        review_count=40,
        featured_until=today + timedelta(days=5),
    )
    # Found through its name only (it is a barber called "Plumber's Cut").
    make_provider(db, barber, "The Plumber's Cut", distance_m=400)

    assert names(search(client, q="plumber")) == ["The Plumber's Cut", "Abu Hassan"]
    assert names(search(client, q="plumber", sort="distance")) == [
        "The Plumber's Cut",
        "Abu Hassan",
    ]


def test_a_name_match_still_puts_verified_before_unverified(client, db):
    _, plumber, _, _ = home_repair_tree(db)
    make_provider(db, plumber, "Sankari Ali", status="unverified", claimed=False)
    make_provider(db, plumber, "Sankari Hadi")

    result = search(client, q="sankari", include_unverified=True)

    assert names(result) == ["Sankari Hadi", "Sankari Ali"]


def osm_listing(db, category, name, *, distance_m, phone=None, whatsapp=None):
    """An imported OpenStreetMap listing; phone may be missing."""
    provider = make_provider(
        db,
        category,
        name,
        distance_m=distance_m,
        status="unverified",
        claimed=False,
        source="osm",
    )
    provider.phone = phone
    provider.whatsapp = whatsapp
    db.commit()
    return provider


def test_unverified_listings_with_a_number_come_before_those_without(client, db):
    _, plumber, _, _ = home_repair_tree(db)
    osm_listing(db, plumber, "No number, closest", distance_m=10)
    osm_listing(db, plumber, "WhatsApp only", distance_m=300, whatsapp="+96170111222")
    osm_listing(db, plumber, "Phone", distance_m=400, phone="+96170333444")
    make_provider(db, plumber, "Verified far", distance_m=450)

    expected = ["Verified far", "WhatsApp only", "Phone", "No number, closest"]
    for sort in ("best", "distance"):
        result = search(client, q="plumber", include_unverified=True, sort=sort)
        assert names(result) == expected, sort
    # Without q the rule is the same.
    assert names(search(client, include_unverified=True, sort="distance")) == expected
    # sort=price: price first (all NULL here), then the same order.
    assert names(search(client, include_unverified=True, sort="price")) == expected


def test_paging_through_text_search_results_counts_every_match(client, db):
    _, plumber, _, barber = home_repair_tree(db)
    for number in range(25):
        make_provider(db, plumber, f"Plumber {number:02d}", distance_m=10 + number * 10)
    make_provider(db, barber, "Salon Rami")

    first = search(client, q="sankari")  # default limit: 20
    second = search(client, q="sankari", offset=20)
    small = search(client, q="sankari", limit=5, offset=5)

    assert len(first["items"]) == 20 and first["total"] == 25
    assert len(second["items"]) == 5 and second["total"] == 25
    assert names(small) == [f"Plumber {n:02d}" for n in range(5, 10)]
    assert set(names(first)) | set(names(second)) == {f"Plumber {n:02d}" for n in range(25)}


def test_q_together_with_category_id_needs_both(client, db):
    home, plumber, electrician, _ = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")
    make_provider(db, electrician, "Karim Hassan")
    make_provider(db, electrician, "Nour")

    assert names(search(client, q="hassan", category_id=electrician.id)) == ["Karim Hassan"]
    assert names(search(client, q="sankari", category_id=electrician.id)) == []
    assert names(search(client, q="sankari", category_id=home.id)) == ["Abu Hassan"]


def test_like_wildcards_in_q_do_not_match_categories(client, db):
    _, plumber, _, _ = home_repair_tree(db)
    make_provider(db, plumber, "Abu Hassan")

    assert names(search(client, q="%%")) == []
    assert names(search(client, q="__")) == []
    assert names(search(client, q="s%ri")) == []


def test_the_default_page_is_20(client, db):
    _, plumber, _, _ = home_repair_tree(db)
    for number in range(22):
        make_provider(db, plumber, f"P{number}", distance_m=10 + number)

    result = search(client)

    assert len(result["items"]) == 20
    assert result["total"] == 22


def test_categories_include_their_aliases(client, db):
    home_repair_tree(db)

    by_slug = {c["slug"]: c for c in client.get("/api/v1/categories").json()}

    assert by_slug["plumber"]["aliases"][:2] == ["plumbing", "pipes"]
    assert "sankari" in by_slug["plumber"]["aliases"]
