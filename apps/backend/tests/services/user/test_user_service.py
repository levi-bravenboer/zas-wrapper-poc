from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.password import PasswordHasher
from app.services.practitioner.practitioner_service import PractitionerService
from app.services.user.errors import CrossTenantAccessError, UserNotFoundError
from app.services.user.user_service import UserService
from tests._rbac import ensure_roles, make_session_user
from tests.fakes.kratos import FakeKratosClient


def _make_service(db_session: AsyncSession) -> UserService:
    factory = async_sessionmaker(db_session.bind, expire_on_commit=False, autoflush=False)
    return UserService(
        db_session,
        UserRepository(db_session),
        PractitionerService(db_session),
        PasswordHasher(),
        FakeKratosClient(factory),
    )


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
    role_slug: str = "default",
    is_active: bool = True,
) -> User:
    user_id = uuid.uuid4()
    roles = await ensure_roles(session, tenant.id)
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=email,
        password_hash="hash",
        display_name=email,
        role_id=roles[role_slug].id,
        is_active=is_active,
    )
    session.add(user)
    await session.flush()
    return user


async def _role_id(session: AsyncSession, tenant: Tenant, slug: str) -> uuid.UUID:
    roles = await ensure_roles(session, tenant.id)
    return roles[slug].id


def _actor(user: User) -> SessionUser:
    # Admin-capable actor: full catalog so the crown-floor guard on
    # `assign_role` admits assigning the admin / patient.accessAll roles.
    # The seeded admin in these tests is always the actor.
    return make_session_user(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=user.tenant_id,
        admin=True,
        role_id=user.role_id,
    )


async def test_get_returns_tenant_scoped_user(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=tenant, email="user@zas.local")
    await db_session.commit()

    service = _make_service(db_session)
    found = await service.get(_actor(admin), target.id)

    assert found.id == target.id


async def test_get_rejects_cross_tenant(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    admin = await _make_user(db_session, tenant=zas, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=other, email="user@other.local")
    await db_session.commit()

    service = _make_service(db_session)
    with pytest.raises(CrossTenantAccessError):
        await service.get(_actor(admin), target.id)


async def test_get_raises_for_missing(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    await db_session.commit()

    service = _make_service(db_session)
    with pytest.raises(UserNotFoundError):
        await service.get(_actor(admin), uuid.uuid4())


async def test_assign_role_updates_target(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=tenant, email="user@zas.local")
    await db_session.commit()

    service = _make_service(db_session)
    admin_role_id = await _role_id(db_session, tenant, "admin")
    updated = await service.assign_role(_actor(admin), target.id, admin_role_id)
    await db_session.commit()

    assert updated.role_id == admin_role_id


async def test_assign_role_rejects_cross_tenant_target(
    db_session: AsyncSession,
) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    admin = await _make_user(db_session, tenant=zas, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=other, email="user@other.local")
    await db_session.commit()

    service = _make_service(db_session)
    admin_role_id = await _role_id(db_session, zas, "admin")
    with pytest.raises(CrossTenantAccessError):
        await service.assign_role(_actor(admin), target.id, admin_role_id)


async def test_assign_role_raises_for_missing_target(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    await db_session.commit()

    service = _make_service(db_session)
    default_role_id = await _role_id(db_session, tenant, "default")
    with pytest.raises(UserNotFoundError):
        await service.assign_role(_actor(admin), uuid.uuid4(), default_role_id)


async def test_assign_role_permits_self_target(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    await db_session.commit()

    service = _make_service(db_session)
    default_role_id = await _role_id(db_session, tenant, "default")
    updated = await service.assign_role(_actor(admin), admin.id, default_role_id)
    await db_session.commit()

    assert updated.id == admin.id
    assert updated.role_id == default_role_id


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
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=tenant, email="user@zas.local")
    await db_session.commit()

    service = _make_service(db_session)
    admin_role_id = await _role_id(db_session, tenant, "admin")
    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        await service.assign_role(_actor(admin), target.id, admin_role_id)
        await db_session.commit()
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    await db_session.refresh(target)
    assert target.updated_by == admin.id


async def test_set_active_toggles(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=tenant, email="user@zas.local")
    await db_session.commit()

    service = _make_service(db_session)
    deactivated = await service.set_active(_actor(admin), target.id, is_active=False)
    await db_session.commit()
    assert deactivated.is_active is False

    reactivated = await service.set_active(_actor(admin), target.id, is_active=True)
    await db_session.commit()
    assert reactivated.is_active is True


async def test_set_active_rejects_cross_tenant_target(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    admin = await _make_user(db_session, tenant=zas, email="admin@zas.local", role_slug="admin")
    target = await _make_user(db_session, tenant=other, email="user@other.local")
    await db_session.commit()

    service = _make_service(db_session)
    with pytest.raises(CrossTenantAccessError):
        await service.set_active(_actor(admin), target.id, is_active=False)


async def test_set_active_raises_for_missing(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(db_session, tenant=tenant, email="admin@zas.local", role_slug="admin")
    await db_session.commit()

    service = _make_service(db_session)
    with pytest.raises(UserNotFoundError):
        await service.set_active(_actor(admin), uuid.uuid4(), is_active=False)
