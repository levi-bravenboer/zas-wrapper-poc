"""Resolve a `users` row + its bound role into a `SessionUser`.

Effective permissions are the role's `role_permissions` rows (the `admin` role
is seeded with the full catalog, so no slug special-casing). Called at
actor-resolution time so every request carries its permission set.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.access.role import Role
from app.db.models.access.role_permission import RolePermission
from app.db.models.user.user import User
from app.schemas.auth.auth import SessionUser


async def load_role_context(
    session: AsyncSession, role_id: UUID
) -> tuple[str, frozenset[str]]:
    """Return (role_slug, effective permission slugs) for a role."""
    role = await session.get(Role, role_id)
    rows = await session.execute(
        select(RolePermission.permission).where(RolePermission.role_id == role_id)
    )
    perms = frozenset(rows.scalars().all())
    return (role.slug if role is not None else ""), perms


async def build_session_user(session: AsyncSession, user: User) -> SessionUser:
    slug, perms = await load_role_context(session, user.role_id)
    return SessionUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=user.tenant_id,
        role_id=user.role_id,
        role_slug=slug,
        permissions=perms,
        patient_id=user.patient_id,
    )
