from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.settings import Settings, SettingsDep
from app.db.audit import SESSION_ACTOR_KEY


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(settings.database_url, future=True, pool_pre_ping=True)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session(request: Request, settings: SettingsDep) -> AsyncIterator[AsyncSession]:
    """Request-scoped session with auto-commit/rollback unit-of-work semantics.

    Commits on successful handler return; rolls back on any raised exception.
    Services and repositories MUST NOT call `session.commit()` themselves.
    Use `await session.flush()` when an INSERT-generated id is needed mid-request.

    Resolves the current authenticated user (via `resolve_actor_from_request`)
    and writes `session.info[SESSION_ACTOR_KEY]` BEFORE yielding so the
    `before_flush` audit hook stamps `tenant_id` / `created_by` / `updated_by`
    on auditable rows. Unauthenticated traffic leaves the slot unset — the
    hook is a no-op for login / health / public endpoints.

    The session factory is wired by `create_app()` and overridden by test
    fixtures; this dependency assumes `request.app.state.session_factory`
    is set.
    """

    # Local import: `services.access.identity.deps` imports back from this module via
    # `SessionDep`, so the dep is resolved lazily here to avoid an import cycle.
    from app.services.access.identity.deps import resolve_actor_from_request

    session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with session_factory() as session:
        actor = await resolve_actor_from_request(session, request, settings)
        if actor is not None:
            session.info[SESSION_ACTOR_KEY] = actor
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_session)]
