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


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(settings.database_url, future=True, pool_pre_ping=True)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session(
    request: Request, settings: SettingsDep
) -> AsyncIterator[AsyncSession]:
    session_factory = getattr(request.app.state, "session_factory", None)
    if session_factory is None:
        engine = create_engine(settings)
        session_factory = create_session_factory(engine)
        request.app.state.db_engine = engine
        request.app.state.session_factory = session_factory
    async with session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
