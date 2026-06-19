"""Persistence for tenant roles + their permission rows (`dynamic-rbac`).

Owns the SQL behind `RoleService` (role lifecycle, permission assignment) and
the request-path `load_role_context` actor-resolution read. Domain rules
(escalation guards, not-found) stay in the service; the repo returns rows /
`None` and never raises domain errors.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select

from app.db.models.access.role import Role
from app.db.models.access.role_permission import RolePermission
from app.db.models.user.user import User
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role]):
    model = Role

    async def get(self, role_id: UUID) -> Role | None:
        return await self._session.get(Role, role_id)

    async def list_in_tenant(self, tenant_id: UUID) -> list[Role]:
        stmt = (
            select(Role)
            .where(Role.tenant_id == tenant_id, Role.deleted_at.is_(None))
            .order_by(Role.name)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def permissions_for(self, role_id: UUID) -> list[str]:
        rows = await self._session.execute(
            select(RolePermission.permission).where(RolePermission.role_id == role_id)
        )
        return sorted(rows.scalars().all())

    async def slug_exists(self, tenant_id: UUID, slug: str) -> bool:
        clash = await self._session.scalar(
            select(Role.id).where(Role.tenant_id == tenant_id, Role.slug == slug)
        )
        return clash is not None

    async def member_count(self, role_id: UUID) -> int:
        count = await self._session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role_id == role_id, User.deleted_at.is_(None))
        )
        return int(count or 0)

    async def load_role_context(self, role_id: UUID) -> tuple[str, frozenset[str]]:
        """Return (role_slug, effective permission slugs) for a role."""
        role = await self._session.get(Role, role_id)
        rows = await self._session.execute(
            select(RolePermission.permission).where(RolePermission.role_id == role_id)
        )
        perms = frozenset(rows.scalars().all())
        return (role.slug if role is not None else ""), perms

    async def add_permission(self, role_id: UUID, permission: str) -> None:
        self._session.add(RolePermission(role_id=role_id, permission=permission))
        await self._session.flush()

    async def remove_permission(self, role_id: UUID, permission: str) -> None:
        row = await self._session.get(RolePermission, (role_id, permission))
        if row is not None:
            await self._session.delete(row)
            await self._session.flush()

    async def rename(self, role: Role, name: str) -> None:
        role.name = name
        await self._session.flush()


__all__ = ["RoleRepository"]
