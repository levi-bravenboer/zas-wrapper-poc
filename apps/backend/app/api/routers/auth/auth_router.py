from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Request, Response

from app.core.enums.user import Role
from app.core.settings import SettingsDep
from app.schemas.auth.auth import LoginRequest, SessionUser
from app.schemas.auth.providers import ProviderDescriptor
from app.services.auth.audit import AuthEvent, log_auth_event
from app.services.auth.auth_service import AuthService
from app.services.auth.deps import (
    AuthServiceDep,
    CurrentUserDep,
    LoginProviderRegistryDep,
    OptionalCurrentUserDep,
    PasswordLoginProviderDep,
)
from app.services.auth.errors import InvalidCredentialsError, UnauthenticatedError

router = APIRouter(tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _set_session_cookie(
    response: Response,
    *,
    settings: SettingsDep,
    auth: AuthService,
    user_id: UUID,
) -> None:
    token = auth.mint_session_token(user_id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
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
    auth: AuthServiceDep,
    provider: PasswordLoginProviderDep,
) -> SessionUser:
    outcome = await provider.try_authenticate(email=payload.email, password=payload.password)
    if outcome.session_user is None:
        log_auth_event(
            AuthEvent(
                event="auth.login.failure",
                provider_key=provider.key,
                client_ip=_client_ip(request),
                user_agent=_user_agent(request),
                user_id=UUID(outcome.user_id) if outcome.user_id else None,
                reason=outcome.reason,
            )
        )
        raise InvalidCredentialsError()

    _set_session_cookie(response, settings=settings, auth=auth, user_id=outcome.session_user.id)
    log_auth_event(
        AuthEvent(
            event="auth.login.success",
            provider_key=provider.key,
            client_ip=_client_ip(request),
            user_agent=_user_agent(request),
            user_id=outcome.session_user.id,
        )
    )
    return outcome.session_user


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
) -> None:
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
