"""Tenant-scoped role management (`dynamic-rbac-roles-permissions`).

Role create/update/delete + permission assignment, guarded against privilege
escalation (D7). Role lifecycle (create/update/delete) and role-to-user
assignment are audited automatically via the `__audited__` before_flush diff
hook on `Role` / `User`. NB: pure `role_permissions`-row changes are not yet
captured (RolePermission is a plain join table) — a follow-up.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.permission import Permission
from app.db.models.access.role import Role
from app.db.models.access.role_permission import RolePermission
from app.db.models.user.user import User
from app.schemas.auth.auth import SessionUser
from app.services.access.rbac.errors import (
    RoleInUseError,
    RoleNotFoundError,
    RoleSlugConflictError,
    SystemRoleImmutableError,
    UnknownPermissionError,
)
from app.services.access.rbac.guard import assert_can_edit_system_role, assert_can_grant

_CATALOG: frozenset[str] = frozenset(p.value for p in Permission)


def permission_catalog() -> list[str]:
    return sorted(_CATALOG)


class RoleService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _permissions_for(self, role_id: UUID) -> list[str]:
        rows = await self._session.execute(
            select(RolePermission.permission).where(RolePermission.role_id == role_id)
        )
        return sorted(rows.scalars().all())

    def _validate_catalog(self, permissions: set[str]) -> None:
        if not permissions <= _CATALOG:
            raise UnknownPermissionError()

    async def list_roles(self, tenant_id: UUID) -> list[tuple[Role, list[str]]]:
        rows = (
            await self._session.execute(
                select(Role)
                .where(Role.tenant_id == tenant_id, Role.deleted_at.is_(None))
                .order_by(Role.name)
            )
        ).scalars().all()
        return [(role, await self._permissions_for(role.id)) for role in rows]

    async def get_role(self, tenant_id: UUID, role_id: UUID) -> tuple[Role, list[str]]:
        role = await self._session.get(Role, role_id)
        if role is None or role.tenant_id != tenant_id or role.deleted_at is not None:
            raise RoleNotFoundError()
        return role, await self._permissions_for(role_id)

    async def create_role(
        self, actor: SessionUser, *, slug: str, name: str, permissions: list[str]
    ) -> tuple[Role, list[str]]:
        perms = set(permissions)
        self._validate_catalog(perms)
        assert_can_grant(actor, perms)
        clash = await self._session.scalar(
            select(Role.id).where(Role.tenant_id == actor.tenant_id, Role.slug == slug)
        )
        if clash is not None:
            raise RoleSlugConflictError()
        role = Role(tenant_id=actor.tenant_id, slug=slug, name=name, is_system=False)
        self._session.add(role)
        await self._session.flush()
        for permission in perms:
            self._session.add(RolePermission(role_id=role.id, permission=permission))
        await self._session.flush()
        return role, sorted(perms)

    async def update_role(
        self,
        actor: SessionUser,
        role_id: UUID,
        *,
        name: str | None,
        permissions: list[str] | None,
    ) -> tuple[Role, list[str]]:
        role, current = await self.get_role(actor.tenant_id, role_id)
        assert_can_edit_system_role(actor, is_system=role.is_system)
        if name is not None and name.strip():
            role.name = name.strip()
        if permissions is not None:
            new = set(permissions)
            self._validate_catalog(new)
            current_set = set(current)
            assert_can_grant(actor, new - current_set)
            # Removing a crown permission is de-escalation; only a system-role
            # edit (already gated above) could remove patient.accessAll.
            for permission in current_set - new:
                row = await self._session.get(RolePermission, (role_id, permission))
                if row is not None:
                    await self._session.delete(row)
            for permission in new - current_set:
                self._session.add(RolePermission(role_id=role_id, permission=permission))
            await self._session.flush()
        await self._session.flush()
        return role, await self._permissions_for(role_id)

    async def delete_role(self, actor: SessionUser, role_id: UUID) -> None:
        role, _ = await self.get_role(actor.tenant_id, role_id)
        if role.is_system:
            raise SystemRoleImmutableError()
        members = await self._session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role_id == role_id, User.deleted_at.is_(None))
        )
        if members:
            raise RoleInUseError()
        await self._session.delete(role)
        await self._session.flush()
