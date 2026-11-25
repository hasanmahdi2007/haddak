"""Alembic entry point: tells Alembic which database to migrate."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, text

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import settings
from app.db import Base

config = context.config

# disable_existing_loggers=False so running migrations from inside the tests
# does not switch off other logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql`: print the SQL instead of running it."""
    context.configure(url=settings.database_url, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


# Any fixed number works; it only has to be the same for every run, so two
# containers starting at once take turns instead of migrating together.
MIGRATION_LOCK_KEY = 4_242_001

# A migration that waits longer than this for a table lock gives up, instead
# of queueing every search behind it (an ALTER TABLE that waits for a lock
# blocks all new queries on that table while it waits). Run it again later.
MIGRATION_LOCK_TIMEOUT = "5s"
# The haddak_api role allows 30 s per statement, which is right for the API
# but too short for building an index on a big table or a backfill.
MIGRATION_STATEMENT_TIMEOUT = "10min"


def run_migrations_online() -> None:
    """Normal mode: connect and run the migrations."""
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        # Session settings (SET, not SET LOCAL), so they last for the whole
        # run, through every migration's transaction.
        connection.execute(text(f"SET statement_timeout = '{MIGRATION_STATEMENT_TIMEOUT}'"))
        # Taken before lock_timeout is set, so a second container waits for
        # the first one to finish (up to the statement timeout) instead of failing.
        connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": MIGRATION_LOCK_KEY})
        connection.execute(text(f"SET lock_timeout = '{MIGRATION_LOCK_TIMEOUT}'"))
        # End the transaction SQLAlchemy opened for the statements above, so
        # Alembic starts and commits its own. The SETs and the advisory lock
        # belong to the connection and stay.
        connection.commit()
        try:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
        finally:
            try:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:key)"), {"key": MIGRATION_LOCK_KEY}
                )
                connection.commit()
            except Exception:
                # A broken connection: closing it below releases the lock anyway.
                # Not raised, so the migration's own error is the one reported.
                pass
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
