from __future__ import annotations

import logging

from fastapi import APIRouter, Request, Response

from app.api._request import client_ip, user_agent
from app.core.enums.audit import AuditAction, AuditResult
from app.core.settings import SettingsDep
from app.repositories.user.deps import UserRepoDep
from app.db.engine import SessionDep
from app.schemas.auth.auth import (
    LoginRequest,
    RoleOption,
    RoleSelectionRequiredResponse,
    RoleSelectRequest,
    SessionUser,
)
from app.schemas.auth.providers import ProviderDescriptor
from app.services.access.identity.audit import AuthEvent, log_auth_event
from app.services.access.identity.deps import (
    KRATOS_IDP,
    CurrentUserDep,
    KratosClientDep,
    LoginProviderRegistryDep,
    OptionalCurrentUserDep,
    role_options_for,
)
from app.services.access.identity.errors import (
    InvalidCredentialsError,
    RoleNotAvailableError,
    UnauthenticatedError,
)
from app.services.access.identity.login_service import (
    RoleSelectionPending,
    authenticate_password,
)
from app.services.access.identity.role_binding import bind_session_role, get_bound_user_id
from app.services.access.rbac.resolver import build_session_user
from app.services.audit.context import AuditContext
from app.services.audit.emit import emit_committed

# PoC is single-tenant (`zas`). Multi-tenant resolution lands at MVP.
from scripts.seed_tenant import ZAS_TENANT_ID

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


def _audit_context(request: Request, *, reason: str | None = None) -> AuditContext:
    # model_validate (not kwargs) so the `str` client IP is coerced to a real
    # IP type by pydantic without tripping the typed constructor signature.
    return AuditContext.model_validate(
        {
            "ip": client_ip(request),
            "user_agent": user_agent(request),
            "reason": reason,
        }
    )


async def _emit_login_audit(
    request: Request,
    *,
    result: AuditResult,
    actor: SessionUser | None,
    reason: str | None = None,
) -> None:
    # Independently committed (D-AUTH-COMMIT) so the trail survives a failed
    # login that returns 401 and rolls the request session back. Best-effort:
    # an audit-store hiccup must not turn a 401 into a 500 or fail a login
    # whose credentials already verified.
    try:
        await emit_committed(
            request.app.state.session_factory,
            action=AuditAction.LOGIN,
            result=result,
            actor=actor,
            context=_audit_context(request, reason=reason),
        )
    except Exception:
        logger.exception("failed to write login audit event")


def _set_session_cookie(
    response: Response,
    *,
    settings: SettingsDep,
    session_token: str,
) -> None:
    # The cookie value IS the Kratos session token; validity, expiry, and
    # revocation live server-side in Kratos (verified via whoami).
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
        path="/",
    )


@router.post(
    "/auth/login/password",
    operation_id="login_password",
    response_model=SessionUser | RoleSelectionRequiredResponse,
)
async def login_password(
    payload: LoginRequest,
    response: Response,
    request: Request,
    settings: SettingsDep,
    session: SessionDep,
    user_repo: UserRepoDep,
    kratos: KratosClientDep,
) -> SessionUser | RoleSelectionRequiredResponse:
    try:
        result = await authenticate_password(
            email=payload.email,
            password=payload.password.get_secret_value(),
            tenant_id=ZAS_TENANT_ID,
            user_filter=lambda u: u.patient_id is None,
            surface="caregiver",
            user_repo=user_repo,
            kratos=kratos,
        )
    except InvalidCredentialsError as exc:
        log_auth_event(
            AuthEvent(
                event="auth.login.failure",
                provider_key="password",
                surface="caregiver",
                client_ip=client_ip(request),
                user_agent=user_agent(request),
                user_id=exc.audit_user_id,
                reason=exc.audit_reason,
            )
        )
        await _emit_login_audit(
            request, result=AuditResult.FAILURE, actor=None, reason=exc.audit_reason
        )
        raise

    _set_session_cookie(response, settings=settings, session_token=result.session_token)
    if isinstance(result, RoleSelectionPending):
        # Multi-role human (REQ-NON-3): session live but unbound — the
        # client picks via POST /auth/session/role before protected routes.
        log_auth_event(
            AuthEvent(
                event="auth.login.success",
                provider_key="password",
                surface="caregiver",
                client_ip=client_ip(request),
                user_agent=user_agent(request),
                user_id=result.roster[0].id,
            )
        )
        await _emit_login_audit(
            request,
            result=AuditResult.SUCCESS,
            actor=await build_session_user(session, result.roster[0]),
        )
        return RoleSelectionRequiredResponse(
            available_roles=await role_options_for(session, result.roster)
        )
    log_auth_event(
        AuthEvent(
            event="auth.login.success",
            provider_key="password",
            surface="caregiver",
            client_ip=client_ip(request),
            user_agent=user_agent(request),
            user_id=result.user.id,
        )
    )
    session_user = await build_session_user(session, result.user)
    await _emit_login_audit(request, result=AuditResult.SUCCESS, actor=session_user)
    return session_user


@router.get(
    "/auth/session/roles",
    operation_id="list_session_roles",
    response_model=list[RoleOption],
)
async def list_session_roles(
    request: Request,
    settings: SettingsDep,
    session: SessionDep,
    user_repo: UserRepoDep,
    kratos: KratosClientDep,
) -> list[RoleOption]:
    """The caller's selectable rows on this surface (REQ-NON-3) — drives the
    role picker and the user-menu switcher. Single-row users get a
    one-element list. Staff surface excludes the patient row."""

    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise UnauthenticatedError()
    kratos_session = await kratos.whoami(session_token=token)
    if kratos_session is None:
        raise UnauthenticatedError()
    roster = await user_repo.list_by_external_identity(
        ZAS_TENANT_ID, KRATOS_IDP, kratos_session.identity_id
    )
    staff = [u for u in roster if u.is_active and u.patient_id is None]
    return await role_options_for(session, staff)


@router.post(
    "/auth/session/role",
    operation_id="select_session_role",
    response_model=SessionUser,
)
async def select_session_role(
    payload: RoleSelectRequest,
    request: Request,
    settings: SettingsDep,
    session: SessionDep,
    user_repo: UserRepoDep,
    kratos: KratosClientDep,
) -> SessionUser:
    """Bind (or re-bind) the session to one of the caller's role rows.

    Works on an unbound fresh login AND as a mid-session role switch —
    no re-authentication (REQ-NON-3 "log in once, choose role"). Every
    switch is audit-logged with the previous and new role.
    """

    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise UnauthenticatedError()
    kratos_session = await kratos.whoami(session_token=token)
    if kratos_session is None:
        raise UnauthenticatedError()
    roster = await user_repo.list_by_external_identity(
        ZAS_TENANT_ID, KRATOS_IDP, kratos_session.identity_id
    )
    target = next(
        (u for u in roster if u.id == payload.user_id and u.is_active and u.patient_id is None),
        None,
    )
    if target is None:
        raise RoleNotAvailableError()

    previous_user_id = await get_bound_user_id(session, kratos_session.session_id)
    await bind_session_role(session, kratos_session_id=kratos_session.session_id, user_id=target.id)
    logger.info(
        "auth.role.bound: session=%s user=%s role_id=%s previous_user=%s",
        kratos_session.session_id,
        target.id,
        target.role_id,
        previous_user_id,
    )
    return await build_session_user(session, target)


@router.get(
    "/auth/providers",
    operation_id="list_login_providers",
    response_model=list[ProviderDescriptor],
)
async def list_login_providers(
    registry: LoginProviderRegistryDep,
) -> list[ProviderDescriptor]:
    return [ProviderDescriptor(key=p.key, label=p.label, kind=p.kind) for p in registry.list()]


@router.get("/auth/me", operation_id="get_current_user", response_model=SessionUser)
async def get_current_user(current_user: CurrentUserDep) -> SessionUser:
    # Caregiver-surface `/auth/me` rejects patient sessions so a leaked
    # patient cookie cannot surface as a caregiver session in orchestrator
    # code paths. Mobile callers use `/mobile/auth/me` instead.
    if current_user.is_patient:
        raise UnauthenticatedError()
    return current_user


@router.post("/auth/logout", operation_id="logout_user", status_code=204)
async def logout_user(
    response: Response,
    request: Request,
    settings: SettingsDep,
    current_user: OptionalCurrentUserDep,
    kratos: KratosClientDep,
) -> None:
    # Revoke server-side first: the session must die at Kratos, not merely
    # leave the browser. A replayed cookie answers 401 immediately after.
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        await kratos.logout(session_token=token)
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
    )
    if current_user is not None:
        log_auth_event(
            AuthEvent(
                event="auth.logout",
                provider_key="session",
                client_ip=client_ip(request),
                user_agent=user_agent(request),
                user_id=current_user.id,
            )
        )


__all__ = ["router"]
