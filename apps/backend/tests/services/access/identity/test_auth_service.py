from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.core.settings import Settings
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.auth_service import AuthService
from app.services.access.identity.authenticator import PasswordAuthenticator
from app.services.access.identity.errors import InvalidCredentialsError, UnauthenticatedError
from app.services.access.identity.password import PasswordHasher


async def _seed(
    session: AsyncSession, *, password: str, is_active: bool = True
) -> tuple[Tenant, User, PasswordHasher]:
    hasher = PasswordHasher()
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email="user@zas.local",
        password_hash=hasher.hash(password),
        display_name="User",
        role=Role.CAREGIVER,
        is_active=is_active,
    )
    session.add(user)
    await session.commit()
    return tenant, user, hasher


def _service(
    session: AsyncSession, tenant_id: uuid.UUID, hasher: PasswordHasher, settings: Settings
) -> AuthService:
    repo = UserRepository(session)
    authenticator = PasswordAuthenticator(repo, hasher, tenant_id=tenant_id)
    return AuthService(authenticator, repo, settings)


async def test_login_returns_session_user_on_valid_credentials(
    db_session: AsyncSession, settings: Settings
) -> None:
    tenant, user, hasher = await _seed(db_session, password="s3cret")
    service = _service(db_session, tenant.id, hasher, settings)

    actor = await service.login(email="user@zas.local", password="s3cret")

    assert actor.id == user.id
    assert actor.tenant_id == tenant.id
    assert actor.role is Role.CAREGIVER


async def test_login_raises_invalid_credentials_on_wrong_password(
    db_session: AsyncSession, settings: Settings
) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret")
    service = _service(db_session, tenant.id, hasher, settings)

    with pytest.raises(InvalidCredentialsError):
        await service.login(email="user@zas.local", password="wrong")


async def test_login_raises_invalid_credentials_for_inactive_user(
    db_session: AsyncSession, settings: Settings
) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret", is_active=False)
    service = _service(db_session, tenant.id, hasher, settings)

    with pytest.raises(InvalidCredentialsError):
        await service.login(email="user@zas.local", password="s3cret")


async def test_load_session_user_returns_active_user(
    db_session: AsyncSession, settings: Settings
) -> None:
    tenant, user, hasher = await _seed(db_session, password="s3cret")
    service = _service(db_session, tenant.id, hasher, settings)

    actor = await service.load_session_user(user.id)

    assert actor.id == user.id
    assert actor.role is Role.CAREGIVER


async def test_load_session_user_rejects_deactivated(
    db_session: AsyncSession, settings: Settings
) -> None:
    tenant, user, hasher = await _seed(db_session, password="s3cret")
    service = _service(db_session, tenant.id, hasher, settings)

    user.is_active = False
    await db_session.commit()

    with pytest.raises(UnauthenticatedError):
        await service.load_session_user(user.id)


async def test_load_session_user_rejects_unknown_id(
    db_session: AsyncSession, settings: Settings
) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret")
    service = _service(db_session, tenant.id, hasher, settings)

    with pytest.raises(UnauthenticatedError):
        await service.load_session_user(uuid.uuid4())
