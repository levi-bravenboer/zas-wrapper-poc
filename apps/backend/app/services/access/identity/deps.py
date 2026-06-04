from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.core.settings import Settings, SettingsDep
from app.db.audit import SESSION_ACTOR_KEY
from app.db.engine import SessionDep
from app.repositories.user.deps import UserRepoDep
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.auth_service import AuthService
from app.services.access.identity.authenticator import KratosAuthenticator
from app.services.access.identity.errors import ForbiddenRoleError, UnauthenticatedError
from app.services.access.identity.kratos_client import KratosClient
from app.services.access.identity.password import PasswordHasher
from app.services.access.identity.providers import (
    LoginProviderRegistry,
    PasswordLoginProvider,
)

# PoC is single-tenant (`zas`). Multi-tenant resolution lands at MVP.
from scripts.seed_tenant import ZAS_TENANT_ID

KRATOS_IDP = "kratos"


def get_kratos_client(request: Request) -> KratosClient:
    return request.app.state.kratos_client


KratosClientDep = Annotated[KratosClient, Depends(get_kratos_client)]


async def resolve_actor_from_request(
    session: AsyncSession, request: Request, settings: Settings
) -> SessionUser | None:
    """Cookie → Kratos whoami → projection lookup → SessionUser.

    The cookie value is the Kratos session token; Kratos owns validity,
    expiry, and revocation. The local `User` row is re-loaded on every
    request so `is_active` flips and role changes take effect immediately.
    Returns `None` for unauthenticated, expired, or revoked sessions.
    Called from `app.db.engine.get_session` to populate
    `session.info[SESSION_ACTOR_KEY]` for the audit hook.
    """

    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    kratos: KratosClient | None = getattr(request.app.state, "kratos_client", None)
    if kratos is None:
        return None
    identity_id = await kratos.whoami(session_token=token)
    if identity_id is None:
        return None
    repo = UserRepository(session)
    user = await repo.get_by_external_identity(ZAS_TENANT_ID, KRATOS_IDP, identity_id)
    if user is None or not user.is_active:
        return None
    return SessionUser.model_validate(user)


def get_password_hasher() -> PasswordHasher:
    return PasswordHasher()


PasswordHasherDep = Annotated[PasswordHasher, Depends(get_password_hasher)]


def get_auth_service(
    session: SessionDep,
    settings: SettingsDep,
    user_repo: UserRepoDep,
    kratos: KratosClientDep,
) -> AuthService:
    del session  # session-bound via user_repo; explicit dep keeps lifespan correct.
    authenticator = KratosAuthenticator(user_repo, kratos, tenant_id=ZAS_TENANT_ID)
    return AuthService(authenticator, user_repo, settings)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_password_login_provider(
    session: SessionDep,
    user_repo: UserRepoDep,
    kratos: KratosClientDep,
) -> PasswordLoginProvider:
    del session
    authenticator = KratosAuthenticator(user_repo, kratos, tenant_id=ZAS_TENANT_ID)
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


def require_role(*roles: Role) -> Callable[[SessionUser], SessionUser]:
    """Return a Depends-compatible callable that enforces `current_user.role`
    is one of `roles`. Empty `roles` is a wiring bug — raise immediately so
    the misconfiguration surfaces at import / first request, not silently
    permits everyone.
    """

    if not roles:
        raise ValueError("require_role requires at least one Role")
    allowed: frozenset[Role] = frozenset(roles)

    def _guard(current_user: CurrentUserDep) -> SessionUser:
        if current_user.role not in allowed:
            raise ForbiddenRoleError()
        return current_user

    return _guard


AdminUserDep = Annotated[SessionUser, Depends(require_role(Role.ADMIN))]
