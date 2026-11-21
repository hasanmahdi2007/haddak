"""Database engine and the per-request session."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import check_startup_settings, settings

# Here and not only in main.py: the container first runs the migrations, which
# open the database through this module, so a bad setting (a mangled
# DATABASE_URL, a missing secret) is reported by name instead of a deep
# SQLAlchemy traceback.
check_startup_settings(settings)

engine = create_engine(
    settings.database_url,
    # Check a pooled connection is still alive before using it.
    pool_pre_ping=True,
    # Always talk to the database in UTC, so timestamps come back as "...Z".
    connect_args={"options": "-c timezone=utc"},
)

SessionLocal = sessionmaker(bind=engine, autoflush=True, expire_on_commit=False)


class Base(DeclarativeBase):
    """Parent class of all table models (see models.py)."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one database session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
