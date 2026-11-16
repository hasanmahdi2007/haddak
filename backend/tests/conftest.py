"""Shared test setup.

Tests run against a real Postgres + PostGIS database called `haddak_test`
(never the development database). Once per test run the database is created
if missing and migrated with Alembic; before every test all rows are deleted.
"""

import os
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://haddak:haddak@localhost:5433/haddak_test"
)
TEST_JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing"
TEST_ADMIN_KEY = "test-admin-key"

# These must be set BEFORE anything from `app` is imported, because
# app/config.py reads the environment at import time.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["SUPABASE_JWKS_URL"] = ""
os.environ["ADMIN_API_KEY"] = TEST_ADMIN_KEY
os.environ["ENVIRONMENT"] = "development"
os.environ["TRUST_PROXY"] = "false"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, Provider  # noqa: E402
from app.rate_limit import limiter  # noqa: E402
from app.services.geo import point_for_storage, project_point  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent

# The point every test searches from (Haret Hreik).
CENTER_LAT = 33.8547
CENTER_LNG = 35.5097

ADMIN_HEADERS = {"X-Admin-Key": TEST_ADMIN_KEY}


def create_test_database_if_missing() -> None:
    url = make_url(TEST_DATABASE_URL)
    # Safety net: the tests delete every row, so refuse anything that does
    # not look like a test database.
    assert url.database.endswith("_test"), "TEST_DATABASE_URL must point to a *_test database"

    # CREATE DATABASE cannot run inside a transaction, hence AUTOCOMMIT.
    maintenance_engine = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with maintenance_engine.connect() as connection:
        exists = connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
        )
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{url.database}"'))
    maintenance_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    """Once per test run: start from empty and apply the real migrations."""
    create_test_database_if_missing()
    with engine.begin() as connection:
        connection.execute(
            text(
                "DROP TABLE IF EXISTS follows, banners, stories, "
                "provider_reports, provider_suggestions, contact_events, "
                "reviews, providers, categories, alembic_version CASCADE"
            )
        )
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def empty_tables(migrated_database):
    """Before every test: delete all rows so tests cannot affect each other."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE follows, banners, stories, "
                "provider_reports, provider_suggestions, contact_events, reviews, "
                "providers, categories RESTART IDENTITY CASCADE"
            )
        )


class FakeClock:
    """A clock the tests control: time only moves when a test says so."""

    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def clock():
    """Before every test: empty the rate limiter and give it a fake clock.

    Emptying it means one test's requests never count against another test.
    A test that needs time to pass (e.g. "ten minutes later") asks for this
    fixture and calls clock.advance(seconds).
    """
    fake_clock = FakeClock()
    limiter.reset()
    limiter.clock = fake_clock
    return fake_clock


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    return TestClient(app)


# ---------- helpers used by the tests ----------


def make_token(user_id: uuid.UUID, *, secret: str = TEST_JWT_SECRET, expired: bool = False) -> str:
    now = datetime.now(UTC)
    expires = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
    claims = {"sub": str(user_id), "aud": "authenticated", "exp": expires}
    return jwt.encode(claims, secret, algorithm="HS256")


def auth_headers(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(user_id)}"}


def make_category(db, slug: str, parent: Category | None = None, sort_order: int = 0) -> Category:
    category = Category(
        slug=slug,
        name_en=slug.replace("-", " ").title(),
        name_ar=f"{slug} بالعربية",
        icon="icon-" + slug,
        parent_id=parent.id if parent else None,
        sort_order=sort_order,
    )
    db.add(category)
    db.commit()
    return category


def make_provider(
    db,
    category: Category,
    name: str = "Test Provider",
    *,
    distance_m: float = 0,
    bearing_deg: float = 0,
    status: str = "verified",
    avg_rating: float = 0,
    review_count: int = 0,
    featured_until: date | None = None,
    owner_user_id: uuid.UUID | None = None,
    show_contact_count: bool = False,
    opening_hours: dict | None = None,
    claimed: bool = True,
    source: str = "owner",
    sponsor_hook: str | None = None,
) -> Provider:
    """Insert a provider exactly `distance_m` metres from the test centre.

    claimed=False makes a listing with no owner, as published from a suggestion.
    """
    lat, lng = project_point(db, CENTER_LAT, CENTER_LNG, distance_m, bearing_deg)
    provider = Provider(
        owner_user_id=(owner_user_id or uuid.uuid4()) if claimed else None,
        source=source,
        slug=uuid.uuid4().hex[:8],
        name=name,
        category_id=category.id,
        phone="+96170123456",
        location=point_for_storage(lat, lng),
        area_name="Haret Hreik",
        photos=["https://example.com/cover.jpg", "https://example.com/second.jpg"],
        verification_doc_url="https://example.com/private/proof.pdf",
        status=status,
        avg_rating=avg_rating,
        review_count=review_count,
        featured_until=featured_until,
        show_contact_count=show_contact_count,
        opening_hours=opening_hours,
        sponsor_hook=sponsor_hook,
    )
    db.add(provider)
    db.commit()
    return provider


def search(client, **params) -> dict:
    """Call the search endpoint from the test centre; returns the JSON body."""
    query = {"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_m": 500, **params}
    response = client.get("/api/v1/providers/search", params=query)
    assert response.status_code == 200, response.text
    return response.json()


def valid_provider_body(category_id: int, **overrides) -> dict:
    """A correct body for POST /me/provider."""
    body = {
        "name": "Ali Tech",
        "category_id": category_id,
        "description": "Laptop and phone repair.",
        "price_text": "From $10",
        "phone": "+96170123456",
        "whatsapp": None,
        "lat": 33.8551,
        "lng": 35.5102,
        "area_name": "Haret Hreik",
        "photos": ["https://example.com/1.jpg"],
        "verification_doc_url": "https://example.com/private/id.pdf",
    }
    body.update(overrides)
    return body
