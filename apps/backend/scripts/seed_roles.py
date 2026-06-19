# POC ONLY — bootstrap seed; replace before non-PoC deployment.
#
# Seeds the two `is_system` RBAC roles every tenant needs
# (`dynamic-rbac-roles-permissions`): `admin` (full permission catalogue,
# incl. `patient.accessAll`) and `default` (`breakGlass.request` only).
# Downstream seeds (users, patient-users, practitioners) FK to these via
# `users.role_id`. Single source of truth so the seed mirror the migration.
#
# Idempotent: roles are looked up by `(tenant_id, slug)`; missing
# `role_permissions` rows are inserted on re-run.
#
# Audit columns: this runs AFTER the bootstrap admin exists (see seed order in
# seed_all), so the admin actor must be bound on the session before calling.

"""Idempotent seed of the per-tenant `admin` + `default` RBAC roles."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.permission import Permission
from app.db.models.access import Role, RolePermission

logger = logging.getLogger(__name__)

ADMIN_ROLE_SLUG = "admin"
DEFAULT_ROLE_SLUG = "default"

# Deterministic per-tenant role ids are derived in `seed_users` from the
# tenant + slug; the `admin` role is referenced by the bootstrap admin user
# before its own row is flushed, so the id must be known up-front.

# admin → full catalogue; default → break-glass request only (mirrors the
# dynamic-rbac migration).
ADMIN_PERMISSIONS: frozenset[str] = frozenset(p.value for p in Permission)
DEFAULT_PERMISSIONS: frozenset[str] = frozenset({Permission.BREAK_GLASS_REQUEST.value})

_ROLE_SPECS: tuple[tuple[str, str, frozenset[str]], ...] = (
    (ADMIN_ROLE_SLUG, "Admin", ADMIN_PERMISSIONS),
    (DEFAULT_ROLE_SLUG, "Default", DEFAULT_PERMISSIONS),
)


async def _get_or_create_role(
    session: AsyncSession, *, tenant_id: UUID, slug: str, name: str
) -> Role:
    existing = (
        await session.execute(select(Role).where(Role.tenant_id == tenant_id, Role.slug == slug))
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("role slug=%s already present", slug)
        return existing
    role = Role(tenant_id=tenant_id, slug=slug, name=name, is_system=True)
    session.add(role)
    await session.flush()
    logger.info("seeded role slug=%s", slug)
    return role


async def _sync_role_permissions(
    session: AsyncSession, *, role_id: UUID, permissions: frozenset[str]
) -> None:
    existing = set(
        (
            await session.execute(
                select(RolePermission.permission).where(RolePermission.role_id == role_id)
            )
        )
        .scalars()
        .all()
    )
    for permission in permissions - existing:
        session.add(RolePermission(role_id=role_id, permission=permission))
    await session.flush()


async def bootstrap_admin_role(session: AsyncSession, *, role_id: UUID, tenant_id: UUID) -> Role:
    """Insert the `admin` role with an explicit id, before the bootstrap admin
    user exists. Roles carry no user FKs (see the `Role` model), so there is
    no cycle — the admin user is created afterwards with `role_id` pointing
    here.
    """

    existing = (
        await session.execute(
            select(Role).where(Role.tenant_id == tenant_id, Role.slug == ADMIN_ROLE_SLUG)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    role = Role(id=role_id, tenant_id=tenant_id, slug=ADMIN_ROLE_SLUG, name="Admin", is_system=True)
    session.add(role)
    await session.flush()
    await _sync_role_permissions(session, role_id=role.id, permissions=ADMIN_PERMISSIONS)
    logger.info("seeded role slug=%s (bootstrap)", ADMIN_ROLE_SLUG)
    return role


async def seed_roles(session: AsyncSession, *, tenant_id: UUID) -> dict[str, Role]:
    """Seed the `admin` + `default` roles (+ permissions) for one tenant.

    Returns a `{slug: Role}` map. The admin actor must already be bound on the
    session so the audit hook can stamp the role rows' audit columns.
    """

    roles: dict[str, Role] = {}
    for slug, name, permissions in _ROLE_SPECS:
        role = await _get_or_create_role(session, tenant_id=tenant_id, slug=slug, name=name)
        await _sync_role_permissions(session, role_id=role.id, permissions=permissions)
        roles[slug] = role
    return roles
