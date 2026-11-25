"""Database engine and the per-request session."""

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import check_startup_settings, settings

# Here and not only in main.py: the container first runs the migrations, which
# open the database through this module, so a bad setting (a mangled
# DATABASE_URL, a missing secret) is reported by name instead of a deep
# SQLAlchemy traceback.
check_startup_settings(settings)

# Pool and timeouts come from settings (DB_* in .env.example). Why these
# numbers: docs/SYSTEM_DESIGN.md §6, "Connection budget".
engine = create_engine(
    settings.database_url,
    # Check a pooled connection is still alive before using it.
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    # A request that cannot get a connection within this many seconds fails
    # with sqlalchemy.exc.TimeoutError, which main.py turns into a 503.
    pool_timeout=settings.db_pool_timeout_seconds,
    pool_recycle=settings.db_pool_recycle_seconds,
    connect_args={
        # Always talk to the database in UTC, so timestamps come back as "...Z".
        "options": "-c timezone=utc",
        "connect_timeout": settings.db_connect_timeout_seconds,
    },
)


@event.listens_for(engine, "connect")
def set_statement_timeout(dbapi_connection, _connection_record) -> None:
    """Runs once for every NEW connection (not for each request).

    Sets the per-query time limit with a plain SET instead of the "options"
    above, because Supabase's connection pooler may not pass startup options
    on to the database. The connection must be in autocommit for a moment,
    otherwise the SET would open a transaction that nobody commits.
    """
    was_autocommit = dbapi_connection.autocommit
    dbapi_connection.autocommit = True
    with dbapi_connection.cursor() as cursor:
        # A whole number of milliseconds; an int from settings, never user input.
        cursor.execute(f"SET statement_timeout = {int(settings.db_statement_timeout_ms)}")
    dbapi_connection.autocommit = was_autocommit


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
