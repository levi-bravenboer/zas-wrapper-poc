from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.settings import Settings
from app.db.base import Base
from app.main import create_app
from tests._settings import build_settings

# Inside the `zas_backend_test` container, compose injects this via env.
# Locally (host-driven `pytest` runs against a side-channel DB) the same URL
# resolves via the published `5433` port on the test_db container.
DEFAULT_TEST_DATABASE_URL = "postgresql+asyncpg://zas:zas@test_db:5432/zas_test"
TEST_DATABASE_URL = os.getenv("BACKEND_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


@pytest.fixture(scope="session")
def db_engine() -> Iterator[AsyncEngine]:
    engine = create_async_engine(TEST_DATABASE_URL, future=True, pool_pre_ping=True)

    async def _bootstrap() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_bootstrap())
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
