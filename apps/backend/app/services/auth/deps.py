from __future__ import annotations

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.core.settings import Settings, SettingsDep
from app.db.audit import SESSION_ACTOR_KEY
from app.db.engine import SessionDep
from app.repositories.user.deps import UserRepoDep
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.auth.auth_service import AuthService
from app.services.auth.authenticator import PasswordAuthenticator
from app.services.auth.errors import ForbiddenRoleError, UnauthenticatedError
from app.services.auth.password import PasswordHasher
from app.services.auth.providers import (
    LoginProviderRegistry,
    PasswordLoginProvider,
)

# PoC is single-tenant (`zas`). Multi-tenant resolution lands at MVP.
from scripts.seed_tenant import ZAS_TENANT_ID

_SESSION_SALT = "session-cookie"


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        settings.session_secret_key.get_secret_value(), salt=_SESSION_SALT
    )


def _decode_user_id(token: str, settings: Settings) -> UUID | None:
    try:
        raw = _serializer(settings).loads(token, max_age=settings.session_max_age_seconds)
    except (BadSignature, SignatureExpired):
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


async def resolve_actor_from_request(
    session: AsyncSession, request: Request, settings: Settings
) -> SessionUser | None:
    """Cookie → user lookup → SessionUser. Returns `None` for unauthenticated
    or stale-cookie requests. Called from `app.db.engine.get_session` to
    populate `session.info[SESSION_ACTOR_KEY]` for the audit hook.
    """

    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    user_id = _decode_user_id(token, settings)
    if user_id is None:
        return None
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None or not user.is_active:
        return None
    return SessionUser.model_validate(user)


def get_password_hasher() -> PasswordHasher:
    return PasswordHasher()


PasswordHasherDep = Annotated[PasswordHasher, Depends(get_password_hasher)]


def get_auth_service(
    session: SessionDep,
    settings: SettingsDep,
    hasher: PasswordHasherDep,
    user_repo: UserRepoDep,
) -> AuthService:
    del session  # session-bound via user_repo; explicit dep keeps lifespan correct.
    authenticator = PasswordAuthenticator(user_repo, hasher, tenant_id=ZAS_TENANT_ID)
    return AuthService(authenticator, user_repo, settings)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_password_login_provider(
    session: SessionDep,
    hasher: PasswordHasherDep,
    user_repo: UserRepoDep,
) -> PasswordLoginProvider:
    del session
    authenticator = PasswordAuthenticator(user_repo, hasher, tenant_id=ZAS_TENANT_ID)
    return PasswordLoginProvider(authenticator)


PasswordLoginProviderDep = Annotated[PasswordLoginProvider, Depends(get_password_login_provider)]


def get_login_provider_registry(
    password_provider: PasswordLoginProviderDep,
) -> LoginProviderRegistry:
    return LoginProviderRegistry([password_provider])


LoginProviderRegistryDep = Annotated[LoginProviderRegistry, Depends(get_login_provider_registry)]


async def get_optional_current_user(session: SessionDep) -> SessionUser | None:
    actor = session.info.get(SESSION_ACTOR_KEY)
    if isinstance(actor, SessionUser):
        return actor
    return None


OptionalCurrentUserDep = Annotated[SessionUser | None, Depends(get_optional_current_user)]


async def get_current_user(
    current_user: OptionalCurrentUserDep,
) -> SessionUser:
    if current_user is None:
        raise UnauthenticatedError()
    return current_user


CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]


def require_role(role: Role) -> Callable[[SessionUser], SessionUser]:
    """Return a Depends-compatible callable that enforces `current_user.role == role`."""

    def _guard(current_user: CurrentUserDep) -> SessionUser:
        if current_user.role is not role:
            raise ForbiddenRoleError()
        return current_user

    return _guard
