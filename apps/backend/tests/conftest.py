from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.settings import Settings
from app.db.audit import SESSION_ACTOR_KEY
from app.db.base import Base
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.main import create_app
from scripts.seed_tenant import seed_zas_tenant
from scripts.seed_users import seed_users
from tests._settings import build_settings

# Inside the `zas_backend_test` container, compose injects this via env.
# Locally (host-driven `pytest` runs against a side-channel DB) the same URL
# resolves via the published `5433` port on the test_db container.
DEFAULT_TEST_DATABASE_URL = "postgresql+asyncpg://zas:zas@test_db:5432/zas_test"
TEST_DATABASE_URL = os.getenv("BACKEND_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


@pytest.fixture(scope="session")
async def db_engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(TEST_DATABASE_URL, future=True, pool_pre_ping=True)
    # drop_all + create_all so schema additions (deleted_at, audit columns)
    # apply to a previously-created test DB on the same volume.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


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
def session_actor() -> object | None:
    """Override per-test to populate `session.info[SESSION_ACTOR_KEY]`.

    Default is `None` (audit hook stays a no-op). Tests that exercise audit
    auto-fill on `AuditableEntity` rows override this with a `SessionUser`.
    """

    return None


@pytest.fixture
async def db_session(
    db_engine: AsyncEngine, session_actor: object | None
) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        if session_actor is not None:
            session.info[SESSION_ACTOR_KEY] = session_actor
        yield session


@pytest.fixture
async def clean_tenants(db_session: AsyncSession) -> AsyncIterator[None]:
    """Wipe the `tenants` (+ dependent `users`) tables around a test.
    Domains that depend on tenant rows opt in via an autouse wrapper in
    their layer's `conftest.py`.
    """

    await _wipe_tenant_scoped_tables(db_session)
    yield
    await _wipe_tenant_scoped_tables(db_session)


async def _wipe_tenant_scoped_tables(session: AsyncSession) -> None:
    # Users and organisations form a cycle (`users.organisation_id` ↔
    # `organisations.created_by/updated_by/deleted_by`), so neither can be
    # deleted while the other still references it. `TRUNCATE ... CASCADE`
    # disables FK checking inside the truncation and atomically wipes both.
    # `tenants` cascades along (every tenant-owned table is included or
    # transitively cleared by the cascade).
    await session.execute(
        text("TRUNCATE TABLE users, organisations, tenants RESTART IDENTITY CASCADE")
    )
    await session.commit()


@pytest.fixture
async def seeded_zas_tenant(db_session: AsyncSession) -> AsyncIterator[Tenant]:
    """Insert the `zas` tenant via the script seed helper.

    Downstream domain tests depend on this fixture instead of running the
    alembic revision or spawning the script subprocess, so the canonical row
    matches what `scripts/seed_all.py` writes in dev / prod.
    """

    tenant = await seed_zas_tenant(db_session)
    await db_session.commit()
    yield tenant


@pytest.fixture
async def seeded_zas_users(
    db_session: AsyncSession, seeded_zas_tenant: Tenant
) -> AsyncIterator[list[User]]:
    """Insert the bootstrap admin + demo caregiver via the script seed helper.

    Downstream tests reuse this fixture instead of building rows manually,
    so the canonical state matches what `scripts/seed_all.py` writes.
    """

    del seeded_zas_tenant  # ordering dep only
    users = await seed_users(db_session)
    await db_session.commit()
    yield users
