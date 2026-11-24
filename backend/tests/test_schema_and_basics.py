"""Health check, categories, and a few checks that the migration built the
schema from docs/SCHEMA.md (index and CHECK constraints)."""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from tests.conftest import make_category, make_provider


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_categories_are_flat_and_ordered_by_sort_order(client, db):
    music = make_category(db, "music-lessons", sort_order=2)
    make_category(db, "tech-repair", sort_order=1)
    make_category(db, "piano-lessons", parent=music, sort_order=3)

    response = client.get("/api/v1/categories")

    assert response.status_code == 200
    items = response.json()
    assert [item["slug"] for item in items] == ["tech-repair", "music-lessons", "piano-lessons"]
    assert items[2]["parent_id"] == music.id
    assert set(items[0]) == {
        "id",
        "slug",
        "name_en",
        "name_ar",
        "icon",
        "parent_id",
        "sort_order",
        "aliases",
    }
    assert items[0]["aliases"] == []  # none given: the column's default


def test_migration_created_the_indexes(db):
    rows = db.execute(
        text("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'")
    )
    indexes = {name: definition for name, definition in rows}
    assert "USING gist (location)" in indexes["providers_location_idx"]
    assert "providers_category_status_idx" in indexes
    assert "contact_events_provider_time_idx" in indexes
    # Trigram indexes for fuzzy category matching in text search (0016).
    assert "gin_trgm_ops" in indexes["categories_name_en_trgm_idx"]
    assert "gin_trgm_ops" in indexes["categories_name_ar_trgm_idx"]


def test_location_column_is_geography_point(db):
    column_type = db.scalar(
        text(
            "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
            "WHERE attrelid = 'providers'::regclass AND attname = 'location'"
        )
    )
    assert column_type == "geography(Point,4326)"


def test_database_rejects_bad_status_and_bad_rating(db):
    category = make_category(db, "plumber")
    provider = make_provider(db, category)

    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE providers SET status = 'banana'"))
    db.rollback()

    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO reviews (provider_id, user_id, author_name, rating) "
                "VALUES (:provider_id, :user_id, 'x', 6)"
            ),
            {"provider_id": provider.id, "user_id": uuid.uuid4()},
        )
    db.rollback()


def test_validation_errors_use_a_plain_string_detail(client):
    response = client.get("/api/v1/providers/search", params={"lat": 33.85})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
