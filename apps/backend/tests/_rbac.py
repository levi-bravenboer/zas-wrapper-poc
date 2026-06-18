"""Test helpers for the dynamic RBAC model (`dynamic-rbac-roles-permissions`).

Use these instead of the removed `Role` enum:
- `make_session_user(...)` builds a `SessionUser` actor with a permission set.
  `admin=True` grants the full catalog (incl. `patient.accessAll`, the Keto
  bypass); otherwise pass explicit `permissions`. `patient_id` marks a patient.
- `ensure_roles(session, tenant_id)` seeds + returns the `admin`/`default`
  roles so ORM `User` rows can set `role_id`.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.core.enums.permission import Permission
from app.db.models.access.role import Role
from app.db.models.access.role_permission import RolePermission
from app.schemas.auth.auth import SessionUser
from scripts.seed_roles import ADMIN_ROLE_SLUG, DEFAULT_ROLE_SLUG, seed_roles

ALL_PERMISSIONS: frozenset[str] = frozenset(p.value for p in Permission)
DEFAULT_PERMISSIONS: frozenset[str] = frozenset({Permission.BREAK_GLASS_REQUEST.value})


def make_session_user(
    *,
    tenant_id: UUID,
    id: UUID | None = None,
    email: str = "actor@zas.local",
    display_name: str = "Test Actor",
    admin: bool = False,
    permissions: frozenset[str] | set[str] | None = None,
    role_id: UUID | None = None,
    role_slug: str | None = None,
    patient_id: UUID | None = None,
) -> SessionUser:
    if admin:
        perms = ALL_PERMISSIONS
        slug = role_slug or ADMIN_ROLE_SLUG
    else:
        perms = frozenset(permissions or ())
        slug = role_slug or (DEFAULT_ROLE_SLUG if patient_id is None else DEFAULT_ROLE_SLUG)
    return SessionUser(
        id=id or uuid4(),
        email=email,
        display_name=display_name,
        tenant_id=tenant_id,
        role_id=role_id or uuid4(),
        role_slug=slug,
        permissions=perms,
        patient_id=patient_id,
    )


async def ensure_roles(session: AsyncSession, tenant_id: UUID) -> dict[str, Role]:
    """Seed (idempotent) and return the tenant's `admin` + `default` roles."""
    return await seed_roles(session, tenant_id=tenant_id)


async def grant_to_role(
    session: AsyncSession,
    *,
    role_slug: str,
    permission: str | Permission,
    tenant_id: UUID | None = None,
) -> None:
    """Grant a permission to a role (by slug) and commit — simulates a
    configured role so a test caregiver can exercise a permission-gated route."""
    query = select(Role).where(Role.slug == role_slug)
    if tenant_id is not None:
        query = query.where(Role.tenant_id == tenant_id)
    role = (await session.execute(query)).scalars().first()
    if role is None:
        raise AssertionError(f"role slug={role_slug} not seeded")
    session.add(RolePermission(role_id=role.id, permission=str(permission)))
    await session.commit()
