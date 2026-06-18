from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from scripts.seed_roles import ADMIN_PERMISSIONS, ADMIN_ROLE_SLUG, bootstrap_admin_role
from scripts.seed_users import admin_role_id


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe `organisations` + `users` + `tenants` around every db-level test."""


async def seed_admin_user(
    session: AsyncSession, *, tenant_id: uuid.UUID, email: str = "a@example.test"
) -> User:
    """Insert the `admin` role then a self-referencing admin user for one tenant.

    Roles carry no user FKs, so there is no cycle: create the role first, then
    the user (`id = created_by = updated_by`, `role_id` → admin role).
    """
    role_id = admin_role_id(tenant_id)
    await bootstrap_admin_role(session, role_id=role_id, tenant_id=tenant_id)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant_id,
        created_by=user_id,
        updated_by=user_id,
        email=email,
        password_hash="hash",
        display_name="Admin Actor",
        role_id=role_id,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


def admin_session_user(user: User) -> SessionUser:
    """Build the bound admin actor (full permission catalogue) for `user`."""
    return SessionUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=user.tenant_id,
        role_id=user.role_id,
        role_slug=ADMIN_ROLE_SLUG,
        permissions=ADMIN_PERMISSIONS,
    )
