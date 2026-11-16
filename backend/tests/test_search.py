"""Radius search: edges of the circle, child categories, ranking order."""

from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import CENTER_LAT, CENTER_LNG, make_category, make_provider, search


def names(result: dict) -> list[str]:
    return [item["name"] for item in result["items"]]


def today():
    return datetime.now(UTC).date()


# ---------- radius ----------


def test_radius_includes_just_inside_and_excludes_just_outside(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "inside 499 m", distance_m=499)
    make_provider(db, category, "outside 501 m", distance_m=501, bearing_deg=90)

    result = search(client, radius_m=500)

    assert names(result) == ["inside 499 m"]
    assert result["total"] == 1


@pytest.mark.parametrize("radius_m, expected_count", [(500, 1), (1000, 2), (5000, 3), (20000, 4)])
def test_each_app_radius_chip(client, db, radius_m, expected_count):
    category = make_category(db, "plumber")
    for distance_m in (300, 800, 3000, 12000, 30000):
        make_provider(db, category, f"{distance_m} m", distance_m=distance_m, bearing_deg=45)

    result = search(client, radius_m=radius_m)

    assert result["total"] == expected_count


def test_distance_m_is_the_real_distance_in_metres(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, distance_m=184, bearing_deg=200)

    item = search(client)["items"][0]

    assert item["distance_m"] == 184
    assert item["lat"] == pytest.approx(CENTER_LAT, abs=0.01)
    assert item["lng"] == pytest.approx(CENTER_LNG, abs=0.01)


def test_radius_limits_are_validated(client):
    for bad_radius in (99, 50001):
        response = client.get(
            "/api/v1/providers/search",
            params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_m": bad_radius},
        )
        assert response.status_code == 422


# ---------- who is visible ----------


def test_only_verified_providers_are_returned(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "verified", status="verified")
    make_provider(db, category, "pending", status="pending")
    make_provider(db, category, "rejected", status="rejected")

    result = search(client)

    assert names(result) == ["verified"]


def test_summary_has_contract_fields_and_no_private_ones(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category)

    item = search(client)["items"][0]

    assert set(item) == {
        "id", "slug", "name", "category", "area_name", "price_text", "price_amount",
        "price_unit", "price_currency", "avg_rating",
        "review_count", "verified", "claimed", "founding_member", "featured", "lat", "lng",
        "distance_m", "cover_photo_url", "open_now", "sponsored", "sponsor_hook",
        "has_active_story", "banner_title",
    }  # fmt: skip
    assert set(item["category"]) == {"id", "slug", "name_en", "name_ar", "icon"}
    assert item["verified"] is True
    assert item["claimed"] is True
    assert item["cover_photo_url"] == "https://example.com/cover.jpg"


# ---------- categories ----------


def test_parent_category_matches_its_children(client, db):
    music = make_category(db, "music-lessons")
    piano = make_category(db, "piano-lessons", parent=music)
    saxophone = make_category(db, "saxophone-lessons", parent=music)
    plumber = make_category(db, "plumber")
    make_provider(db, music, "general music teacher")
    make_provider(db, piano, "piano teacher")
    make_provider(db, saxophone, "saxophone teacher")
    make_provider(db, plumber, "plumber")

    by_parent = search(client, category_id=music.id)
    by_child = search(client, category_id=piano.id)

    assert sorted(names(by_parent)) == [
        "general music teacher",
        "piano teacher",
        "saxophone teacher",
    ]
    assert by_parent["total"] == 3
    assert names(by_child) == ["piano teacher"]


def test_unknown_category_gives_empty_result(client, db):
    make_provider(db, make_category(db, "plumber"))

    result = search(client, category_id=99999)

    assert result == {"items": [], "total": 0}


# ---------- ranking ----------


def test_featured_comes_first_even_with_lower_rating_and_further_away(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "top rated", distance_m=50, avg_rating=5.0, review_count=100)
    make_provider(
        db, category, "featured", distance_m=400, avg_rating=3.0, review_count=2,
        featured_until=today(),  # "featured" includes the last day itself
    )  # fmt: skip

    result = search(client)

    assert names(result) == ["featured", "top rated"]
    assert [item["featured"] for item in result["items"]] == [True, False]


def test_expired_featured_is_ranked_like_everyone_else(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "better rating", avg_rating=4.9, review_count=40)
    make_provider(
        db, category, "was featured", avg_rating=4.0, review_count=40,
        featured_until=today() - timedelta(days=1),
    )  # fmt: skip

    result = search(client)

    assert names(result) == ["better rating", "was featured"]
    assert result["items"][1]["featured"] is False


def test_weighted_rating_many_good_reviews_beat_one_perfect_review(client, db):
    category = make_category(db, "plumber")
    # weighted: (1*5.0 + 17.5) / 6 = 3.75
    make_provider(db, category, "one 5-star review", distance_m=10, avg_rating=5, review_count=1)
    # weighted: (50*4.8 + 17.5) / 55 = 4.68
    make_provider(db, category, "fifty 4.8 reviews", distance_m=40, avg_rating=4.8, review_count=50)
    # weighted: (0 + 17.5) / 5 = 3.5
    make_provider(db, category, "no reviews", distance_m=5)

    result = search(client)

    assert names(result) == ["fifty 4.8 reviews", "one 5-star review", "no reviews"]


def test_equal_ratings_are_ordered_by_distance(client, db):
    category = make_category(db, "plumber")
    make_provider(db, category, "far", distance_m=450, avg_rating=4.5, review_count=10)
    make_provider(db, category, "near", distance_m=100, avg_rating=4.5, review_count=10)
    make_provider(db, category, "middle", distance_m=250, avg_rating=4.5, review_count=10)

    result = search(client)

    assert names(result) == ["near", "middle", "far"]
    assert [item["distance_m"] for item in result["items"]] == [100, 250, 450]


def test_full_ordering_featured_then_rating_then_distance(client, db):
    category = make_category(db, "plumber")
    next_week = today() + timedelta(days=7)
    make_provider(db, category, "4 plain near", distance_m=100, avg_rating=4.0, review_count=20)
    make_provider(db, category, "3 plain high", distance_m=300, avg_rating=4.9, review_count=20)
    make_provider(
        db, category, "2 featured low", distance_m=50, avg_rating=3.0, review_count=20,
        featured_until=next_week,
    )  # fmt: skip
    make_provider(
        db, category, "1 featured high", distance_m=450, avg_rating=4.5, review_count=20,
        featured_until=next_week,
    )  # fmt: skip
    make_provider(db, category, "5 plain far", distance_m=200, avg_rating=4.0, review_count=20)

    result = search(client)

    assert names(result) == [
        "1 featured high",
        "2 featured low",
        "3 plain high",
        "4 plain near",
        "5 plain far",
    ]


# ---------- paging ----------


def test_limit_and_offset_page_through_results_and_total_counts_all(client, db):
    category = make_category(db, "plumber")
    for distance_m in (100, 200, 300, 400):
        make_provider(db, category, f"{distance_m} m", distance_m=distance_m)

    first_page = search(client, limit=2, offset=0)
    second_page = search(client, limit=2, offset=2)

    assert names(first_page) == ["100 m", "200 m"]
    assert names(second_page) == ["300 m", "400 m"]
    assert first_page["total"] == 4
    assert second_page["total"] == 4
