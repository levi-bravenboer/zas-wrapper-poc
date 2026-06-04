from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.core.enums.user import Role
from app.core.settings import SettingsDep
from app.repositories.patient.deps import PatientRepoDep
from app.repositories.tenant.deps import TenantRepoDep
from app.repositories.user.deps import UserRepoDep
from app.schemas.auth.mobile_session import (
    MobileLoginRequest,
    MobileLoginResponse,
    PatientSession,
)
from app.services.auth.audit import AuthEvent, log_auth_event
from app.services.auth.deps import AuthServiceDep, PasswordHasherDep
from app.services.auth.errors import InvalidCredentialsError
from app.services.auth.login_service import authenticate_password
from app.services.auth.tenant_resolver import resolve_tenant_slug

router = APIRouter(tags=["mobile"])


@router.post(
    "/mobile/auth/login/password",
    operation_id="mobile_login_password",
    response_model=MobileLoginResponse,
)
async def mobile_login_password(
    payload: MobileLoginRequest,
    response: Response,
    request: Request,
    settings: SettingsDep,
    auth: AuthServiceDep,
    user_repo: UserRepoDep,
    hasher: PasswordHasherDep,
    tenant_repo: TenantRepoDep,
    patient_repo: PatientRepoDep,
) -> MobileLoginResponse:
    tenant_id = await resolve_tenant_slug(payload.tenant, repo=tenant_repo)

    try:
        result = await authenticate_password(
            email=payload.email,
            password=payload.password.get_secret_value(),
            tenant_id=tenant_id,
            role_filter=lambda r: r == Role.PATIENT,
            role=Role.PATIENT,
            surface="mobile",
            user_repo=user_repo,
            hasher=hasher,
        )
    except InvalidCredentialsError as exc:
        log_auth_event(
            AuthEvent(
                event="auth.login.failure",
                provider_key="password",
                surface="mobile",
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                user_id=exc.audit_user_id,
                reason=exc.audit_reason,
            )
        )
        raise

    # Validate patient link BEFORE issuing the session cookie so a
    # broken user row never receives a live token.
    if result.user.patient_id is None:
        raise InvalidCredentialsError(
            audit_reason="null_password_hash",
            audit_user_id=result.user.id,
        )

    patient = await patient_repo.get_by_id(result.user.tenant_id, result.user.patient_id)
    if patient is None:
        raise InvalidCredentialsError(
            audit_reason="unknown_email",
            audit_user_id=result.user.id,
        )

    token = auth.mint_session_token(result.user.id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
        path="/",
    )

    log_auth_event(
        AuthEvent(
            event="auth.login.success",
            provider_key="password",
            surface="mobile",
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            user_id=result.user.id,
        )
    )

    return MobileLoginResponse(
        session=PatientSession(
            id=result.user.id,
            given_name=patient.given_name,
            patient_id=result.user.patient_id,
            tenant_id=result.user.tenant_id,
        )
    )
