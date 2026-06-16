"""Async Alembic environment wired to the FastAPI engine + settings."""

from __future__ import annotations

import alembic_postgresql_enum  # noqa: F401
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.settings import get_settings
from app.db.base import Base

# Import all models so Base.metadata is populated for autogenerate.
import app.db.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    # Soft-delete-aware partial unique indexes (`*_live`, WHERE
    # deleted_at IS NULL) are maintained in migrations only — autogenerate
    # can't round-trip the partial WHERE reliably, so it would spuriously
    # drop/recreate them on every run. Exclude them from drift comparison.
    if type_ == "index" and name and name.endswith("_live"):
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online_with_connection(connection: Connection) -> None:
    """Hook for tests / programmatic callers: reuse an existing connection."""
    do_run_migrations(connection)


injected_connection: Connection | None = config.attributes.get("connection")

if context.is_offline_mode():
    run_migrations_offline()
elif injected_connection is not None:
    run_migrations_online_with_connection(injected_connection)
else:
    asyncio.run(run_migrations_online())
