from __future__ import annotations

from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """Base class for per-domain repositories.

    Subclasses set the `model` class attribute and may add entity-specific
    query methods. Repositories own SQL — services orchestrate, repositories
    fetch and persist. Repositories MUST NOT raise domain errors (return
    `None` / empty collections instead) and MUST NOT call `session.commit()`
    — the request-scoped session dependency in `app.db.engine` handles the
    transaction boundary.
    """

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> list[T]:
        result = await self._session.execute(select(self.model))
        return list(result.scalars().all())

    async def add(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def delete(self, entity: T) -> None:
        await self._session.delete(entity)
        await self._session.flush()
