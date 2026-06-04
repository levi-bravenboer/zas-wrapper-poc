from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import InstrumentedAttribute

from app.core.enums.user import Role
from app.db.models.practitioner.practitioner import Practitioner
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
        "has_practitioner": frozenset({"eq"}),
    }
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = (
        User.display_name,
        User.email,
    )
    default_order: ClassVar[tuple[str, str]] = ("display_name", "asc")

    def _filter_predicate(
        self,
        field: str,
        operator: Operator,
        values: Sequence[str],
    ) -> ColumnElement[bool]:
        if field == "has_practitioner":
            wants = values[0].lower() in {"1", "true", "yes", "on"}
            exists_clause = (
                sa.select(Practitioner.id)
                .where(
                    Practitioner.user_id == User.id,
                    Practitioner.deleted_at.is_(None),
                )
                .exists()
            )
            return exists_clause if wants else ~exists_clause
        return super()._filter_predicate(field, operator, values)

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(
        self, tenant_id: UUID, email: str, *, role: Role | None = None
    ) -> User | None:
        filters = [
            User.tenant_id == tenant_id,
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        ]
        if role is not None:
            filters.append(User.role == role)
        result = await self._session.execute(select(User).where(*filters))
        return result.scalar_one_or_none()

    async def get_by_external_identity(
        self,
        tenant_id: UUID,
        external_idp: str,
        external_subject: str,
    ) -> User | None:
        """Single-row resolution; raises if the identity maps to several
        role rows — multi-role callers use `list_by_external_identity`."""

        result = await self._session.execute(
            select(User).where(
                User.tenant_id == tenant_id,
                User.external_idp == external_idp,
                User.external_subject == external_subject,
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_external_identity(
        self,
        tenant_id: UUID,
        external_idp: str,
        external_subject: str,
    ) -> list[User]:
        """The identity's role-row roster (multi-role humans, REQ-NON-3)."""

        result = await self._session.execute(
            select(User)
            .where(
                User.tenant_id == tenant_id,
                User.external_idp == external_idp,
                User.external_subject == external_subject,
                User.deleted_at.is_(None),
            )
            .order_by(User.role)
        )
        return list(result.scalars().all())

    async def list_by_email(self, tenant_id: UUID, email: str) -> list[User]:
        """All role rows sharing one email (multi-role humans, REQ-NON-3)."""

        result = await self._session.execute(
            select(User)
            .where(
                User.tenant_id == tenant_id,
                func.lower(User.email) == email.lower(),
                User.deleted_at.is_(None),
            )
            .order_by(User.role)
        )
        return list(result.scalars().all())

    async def update(self, user: User) -> User:
        await self._session.flush()
        return user
