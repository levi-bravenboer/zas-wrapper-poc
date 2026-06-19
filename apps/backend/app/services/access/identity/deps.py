from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings, SettingsDep
from app.db.audit import SESSION_ACTOR_KEY
from app.db.engine import SessionDep
from app.db.models.access.role import Role
from app.db.models.user.user import User
from app.repositories.user.deps import UserRepoDep
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import RoleOption, SessionUser
from app.services.access.identity.auth_service import AuthService
from app.services.access.identity.authenticator import KratosAuthenticator
from app.services.access.identity.errors import (
    RoleSelectionRequiredError,
    UnauthenticatedError,
)
from app.services.access.identity.role_binding import get_bound_user_id
from app.services.access.identity.kratos_client import KratosClient
from app.services.access.identity.password import PasswordHasher
from app.services.access.identity.providers import (
    LoginProviderRegistry,
    PasswordLoginProvider,
)
from app.services.access.rbac.resolver import build_session_user

# PoC is single-tenant (`zas`). Multi-tenant resolution lands at MVP.
from scripts.seed_tenant import ZAS_TENANT_ID

KRATOS_IDP = "kratos"


def get_kratos_client(request: Request) -> KratosClient:
    return request.app.state.kratos_client


KratosClientDep = Annotated[KratosClient, Depends(get_kratos_client)]


async def resolve_actor_from_request(
    session: AsyncSession, request: Request, settings: Settings
) -> SessionUser | None:
    """Cookie → Kratos whoami → roster → binding → SessionUser.

    The cookie value is the Kratos session token; Kratos owns validity,
    expiry, and revocation. The bound local `User` row is re-loaded on
    every request so `is_active` flips and role changes take effect
    immediately. Returns `None` for unauthenticated, expired, or revoked
    sessions.

    Multi-role (REQ-NON-3): the identity's roster decides —
    - one row → that row (no binding consulted or written);
    - several rows → the `session_role_bindings` row for THIS Kratos
      session picks the active role. Without a binding the request is not
      yet an actor: `request.state.role_selection_required` is flagged so
      `get_current_user` answers 409 (not 401) on protected routes.

    Called from `app.db.engine.get_session` to populate
    `session.info[SESSION_ACTOR_KEY]` for the audit hook.
    """

    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    kratos: KratosClient | None = getattr(request.app.state, "kratos_client", None)
    if kratos is None:
        return None
    kratos_session = await kratos.whoami(session_token=token)
    if kratos_session is None:
        return None
    repo = UserRepository(session)
    roster = await repo.list_by_external_identity(
        ZAS_TENANT_ID, KRATOS_IDP, kratos_session.identity_id
    )
    if not roster:
        return None
    if len(roster) == 1:
        user = roster[0]
    else:
        bound_user_id = await get_bound_user_id(session, kratos_session.session_id)
        user = next((u for u in roster if u.id == bound_user_id), None)
        if user is None:
            request.state.role_selection_required = True
            request.state.available_roles = [
                opt.model_dump(mode="json")
                for opt in await role_options_for(session, [u for u in roster if u.is_active])
            ]
            return None
    if not user.is_active:
        return None
    return await build_session_user(session, user)


async def role_options_for(session: AsyncSession, users: list[User]) -> list[RoleOption]:
    """Selectable rows for a multi-row human (role-selection / login response).
    Identified by user_id (slugs collide for patient+caregiver), labelled by
    role slug + the patient facet."""
    role_ids = {u.role_id for u in users}
    slug_by_id: dict = {}
    if role_ids:
        rows = await session.execute(select(Role.id, Role.slug).where(Role.id.in_(role_ids)))
        slug_by_id = {rid: slug for rid, slug in rows.all()}
    return [
        RoleOption(
            user_id=u.id,
            role_slug=slug_by_id.get(u.role_id, ""),
            is_patient=u.patient_id is not None,
        )
        for u in users
    ]


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
    authenticator = KratosAuthenticator(user_repo, kratos, tenant_id=ZAS_TENANT_ID)
    return PasswordLoginProvider(authenticator, session)


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
    request: Request,
) -> SessionUser:
    if current_user is None:
        if getattr(request.state, "role_selection_required", False):
            # live multi-role session without a binding (REQ-NON-3); the
            # details let the client render the picker without re-login
            raise RoleSelectionRequiredError(
                details={"available_roles": getattr(request.state, "available_roles", [])}
            )
        raise UnauthenticatedError()
    return current_user


CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]
