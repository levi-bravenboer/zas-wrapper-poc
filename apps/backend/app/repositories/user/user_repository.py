from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select

from app.db.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, tenant_id: UUID, email: str) -> User | None:
        result = await self._session.execute(
            select(User).where(
                User.tenant_id == tenant_id,
                func.lower(User.email) == email.lower(),
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_in_tenant(self, tenant_id: UUID, *, active: bool | None = None) -> list[User]:
        stmt = select(User).where(
            User.tenant_id == tenant_id,
            User.deleted_at.is_(None),
        )
        if active is not None:
            stmt = stmt.where(User.is_active.is_(active))
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def update(self, user: User) -> User:
        await self._session.flush()
        return user
