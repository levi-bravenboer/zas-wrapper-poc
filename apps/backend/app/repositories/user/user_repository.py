from __future__ import annotations

from collections.abc import Mapping
from typing import ClassVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import InstrumentedAttribute

from app.db.models.user import User
from app.repositories.base import BaseListRepository
from app.schemas._list.list_query import Operator


class UserRepository(BaseListRepository[User]):
    model = User

    orderable_fields: ClassVar[frozenset[str]] = frozenset(
        {"display_name", "email", "role", "is_active", "created_at"}
    )
    filterable_fields: ClassVar[Mapping[str, frozenset[Operator]]] = {
        "role": frozenset({"eq", "in", "not"}),
        "is_active": frozenset({"eq"}),
    }
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = (
        User.display_name,
        User.email,
    )
    default_order: ClassVar[tuple[str, str]] = ("display_name", "asc")

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

    async def get_by_external_identity(
        self,
        tenant_id: UUID,
        external_idp: str,
        external_subject: str,
    ) -> User | None:
        result = await self._session.execute(
            select(User).where(
                User.tenant_id == tenant_id,
                User.external_idp == external_idp,
                User.external_subject == external_subject,
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def update(self, user: User) -> User:
        await self._session.flush()
        return user
