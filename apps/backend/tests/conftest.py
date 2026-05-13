from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.settings import Settings
from app.main import create_app
from tests._settings import build_settings

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _apply_migrations(connection: Connection) -> None:
    config = Config(str(_BACKEND_ROOT / "alembic.ini"))
    config.attributes["connection"] = connection
    command.upgrade(config, "head")


@pytest.fixture(scope="session")
def db_engine() -> Iterator[AsyncEngine]:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    async def _migrate() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(_apply_migrations)

    asyncio.run(_migrate())
    try:
        yield engine
    finally:
        asyncio.run(engine.dispose())


@pytest.fixture
def settings() -> Settings:
    return build_settings(
        session_secret_key=SecretStr("test-secret"),
        database_url=TEST_DATABASE_URL,
    )


@pytest.fixture
def app(settings: Settings, db_engine: AsyncEngine) -> FastAPI:
    app = create_app(settings)
    app.state.db_engine = db_engine
    app.state.session_factory = async_sessionmaker(
        db_engine, expire_on_commit=False, autoflush=False
    )
    return app


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session
