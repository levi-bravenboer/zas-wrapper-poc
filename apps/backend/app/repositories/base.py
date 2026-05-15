from __future__ import annotations

from typing import Generic, TypeVar

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit import SESSION_ACTOR_KEY
from app.db.base import AuditableEntity, Entity

T = TypeVar("T", bound=Entity)


class BaseRepository(Generic[T]):
    """Base class for per-domain repositories.

    Subclasses set the `model` class attribute and may add entity-specific
    query methods. Repositories own SQL — services orchestrate, repositories
    fetch and persist. Repositories MUST NOT raise domain errors (return
    `None` / empty collections instead) and MUST NOT call `session.commit()`
    — the request-scoped session dependency in `app.db.engine` handles the
    transaction boundary.

    Soft delete: rows with `deleted_at IS NOT NULL` are filtered out by
    `list()`. Use `list_including_deleted()` to opt in. Custom subclass
    queries MUST add `where(model.deleted_at.is_(None))` unless they
    intentionally surface soft-deleted rows.

    `soft_delete(entity)` sets `deleted_at = func.now()` and, when the entity
    inherits `AuditableEntity`, sets `deleted_by` from
    `session.info[SESSION_ACTOR_KEY]` (left untouched when no actor is set).
    """

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> list[T]:
        result = await self._session.execute(
            select(self.model).where(self.model.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def list_including_deleted(self) -> list[T]:
        result = await self._session.execute(select(self.model))
        return list(result.scalars().all())

    async def add(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def soft_delete(self, entity: T) -> None:
        """Mark the row as logically deleted. Does NOT remove it from the table."""

        entity.deleted_at = sa.func.now()  # type: ignore[assignment]
        if isinstance(entity, AuditableEntity):
            actor = self._session.info.get(SESSION_ACTOR_KEY)
            if actor is not None:
                entity.deleted_by = actor.id
        await self._session.flush()

    async def hard_delete(self, entity: T) -> None:
        """Physically remove the row. Prefer `soft_delete` unless retention rules forbid it."""

        await self._session.delete(entity)
        await self._session.flush()
