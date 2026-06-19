"""Tenant-scoped role management (`dynamic-rbac-roles-permissions`).

Role create/update/delete + permission assignment, guarded against privilege
escalation (D7). Role lifecycle (create/update/delete) and role-to-user
assignment are audited automatically via the `__audited__` before_flush diff
hook on `Role` / `User`. NB: pure `role_permissions`-row changes are not yet
captured (RolePermission is a plain join table) — a follow-up.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.permission import Permission
from app.db.models.access.role import Role
from app.repositories.access.role_repository import RoleRepository
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
        self._repo = RoleRepository(session)

    def _validate_catalog(self, permissions: set[str]) -> None:
        if not permissions <= _CATALOG:
            raise UnknownPermissionError()

    async def list_roles(self, tenant_id: UUID) -> list[tuple[Role, list[str]]]:
        roles = await self._repo.list_in_tenant(tenant_id)
        return [(role, await self._repo.permissions_for(role.id)) for role in roles]

    async def get_role(self, tenant_id: UUID, role_id: UUID) -> tuple[Role, list[str]]:
        role = await self._repo.get(role_id)
        if role is None or role.tenant_id != tenant_id or role.deleted_at is not None:
            raise RoleNotFoundError()
        return role, await self._repo.permissions_for(role_id)

    async def create_role(
        self, actor: SessionUser, *, slug: str, name: str, permissions: list[str]
    ) -> tuple[Role, list[str]]:
        perms = set(permissions)
        self._validate_catalog(perms)
        assert_can_grant(actor, perms)
        if await self._repo.slug_exists(actor.tenant_id, slug):
            raise RoleSlugConflictError()
        role = await self._repo.add(
            Role(tenant_id=actor.tenant_id, slug=slug, name=name, is_system=False)
        )
        for permission in perms:
            await self._repo.add_permission(role.id, permission)
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
            await self._repo.rename(role, name.strip())
        if permissions is not None:
            new = set(permissions)
            self._validate_catalog(new)
            current_set = set(current)
            assert_can_grant(actor, new - current_set)
            # Removing a crown permission is de-escalation; only a system-role
            # edit (already gated above) could remove patient.accessAll.
            for permission in current_set - new:
                await self._repo.remove_permission(role_id, permission)
            for permission in new - current_set:
                await self._repo.add_permission(role_id, permission)
        return role, await self._repo.permissions_for(role_id)

    async def delete_role(self, actor: SessionUser, role_id: UUID) -> None:
        role, _ = await self.get_role(actor.tenant_id, role_id)
        if role.is_system:
            raise SystemRoleImmutableError()
        if await self._repo.member_count(role_id):
            raise RoleInUseError()
        await self._repo.hard_delete(role)
