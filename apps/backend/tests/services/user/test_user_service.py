from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.user.errors import CrossTenantAccessError, UserNotFoundError
from app.services.user.user_service import UserService


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    return tenant


async def _make_user(
    session: AsyncSession,
    *,
    tenant: Tenant,
    email: str,
    role: Role = Role.CAREGIVER,
) -> User:
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=email,
        password_hash="hash",
        display_name=email,
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


def _actor(user: User) -> SessionUser:
    return SessionUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=user.tenant_id,
        role=user.role,
    )


async def test_list_in_tenant_scopes_results(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    await _make_user(db_session, tenant=zas, email="a@zas.local")
    await _make_user(db_session, tenant=other, email="a@other.local")
    await db_session.commit()

    service = UserService(UserRepository(db_session))
    rows = await service.list_in_tenant(zas.id)

    assert len(rows) == 1
    assert rows[0].tenant_id == zas.id


async def test_assign_role_updates_target(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role=Role.ADMIN)
    target = await _make_user(db_session, tenant=tenant, email="user@zas.local")
    await db_session.commit()

    service = UserService(UserRepository(db_session))
    updated = await service.assign_role(_actor(admin), target.id, Role.ADMIN)
    await db_session.commit()

    assert updated.role is Role.ADMIN


async def test_assign_role_rejects_cross_tenant_target(
    db_session: AsyncSession,
) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    admin = await _make_user(db_session, tenant=zas, email="admin@zas.local", role=Role.ADMIN)
    target = await _make_user(db_session, tenant=other, email="user@other.local")
    await db_session.commit()

    service = UserService(UserRepository(db_session))
    with pytest.raises(CrossTenantAccessError):
        await service.assign_role(_actor(admin), target.id, Role.ADMIN)


async def test_assign_role_raises_for_missing_target(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role=Role.ADMIN)
    await db_session.commit()

    service = UserService(UserRepository(db_session))
    with pytest.raises(UserNotFoundError):
        await service.assign_role(_actor(admin), uuid.uuid4(), Role.CAREGIVER)


async def test_assign_role_permits_self_target(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role=Role.ADMIN)
    await db_session.commit()

    service = UserService(UserRepository(db_session))
    updated = await service.assign_role(_actor(admin), admin.id, Role.CAREGIVER)
    await db_session.commit()

    assert updated.id == admin.id
    assert updated.role is Role.CAREGIVER


async def test_assign_role_audit_hook_stamps_updated_by(
    db_session: AsyncSession,
) -> None:
    """When `session.info[SESSION_ACTOR_KEY]` is set, the audit hook should
    auto-fill `updated_by` on the dirty row. We seed admin + target without
    the slot (explicit audit cols), then commit the role change with the
    slot populated and assert the column reflects the actor.
    """

    from app.db.audit import SESSION_ACTOR_KEY

    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role=Role.ADMIN)
    target = await _make_user(db_session, tenant=tenant, email="user@zas.local")
    await db_session.commit()

    service = UserService(UserRepository(db_session))
    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        await service.assign_role(_actor(admin), target.id, Role.ADMIN)
        await db_session.commit()
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    await db_session.refresh(target)
    assert target.updated_by == admin.id
