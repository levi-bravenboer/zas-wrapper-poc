from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.core.enums.user import Role
from app.core.settings import SettingsDep
from app.repositories.user.deps import UserRepoDep
from app.schemas.auth.auth import LoginRequest, SessionUser
from app.schemas.auth.providers import ProviderDescriptor
from app.services.access.identity.audit import AuthEvent, log_auth_event
from app.services.access.identity.deps import (
    CurrentUserDep,
    KratosClientDep,
    LoginProviderRegistryDep,
    OptionalCurrentUserDep,
)
from app.services.access.identity.errors import InvalidCredentialsError, UnauthenticatedError
from app.services.access.identity.login_service import authenticate_password

# PoC is single-tenant (`zas`). Multi-tenant resolution lands at MVP.
from scripts.seed_tenant import ZAS_TENANT_ID

router = APIRouter(tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


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
    response_model=SessionUser,
)
async def login_password(
    payload: LoginRequest,
    response: Response,
    request: Request,
    settings: SettingsDep,
    user_repo: UserRepoDep,
    kratos: KratosClientDep,
) -> SessionUser:
    try:
        result = await authenticate_password(
            email=payload.email,
            password=payload.password.get_secret_value(),
            tenant_id=ZAS_TENANT_ID,
            role_filter=lambda r: r != Role.PATIENT,
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
                client_ip=_client_ip(request),
                user_agent=_user_agent(request),
                user_id=exc.audit_user_id,
                reason=exc.audit_reason,
            )
        )
        raise

    _set_session_cookie(response, settings=settings, session_token=result.session_token)
    log_auth_event(
        AuthEvent(
            event="auth.login.success",
            provider_key="password",
            surface="caregiver",
            client_ip=_client_ip(request),
            user_agent=_user_agent(request),
            user_id=result.user.id,
        )
    )
    return SessionUser.model_validate(result.user)


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
    if current_user.role == Role.PATIENT:
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
                client_ip=_client_ip(request),
                user_agent=_user_agent(request),
                user_id=current_user.id,
            )
        )


__all__ = ["router"]
