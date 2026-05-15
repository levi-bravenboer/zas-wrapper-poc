from __future__ import annotations

from fastapi import APIRouter, Response

from app.core.settings import SettingsDep
from app.schemas.auth.auth import LoginRequest, SessionUser
from app.services.auth.deps import AuthServiceDep, CurrentUserDep

router = APIRouter(tags=["auth"])


@router.post("/auth/login", operation_id="login_user", response_model=SessionUser)
async def login_user(
    payload: LoginRequest,
    response: Response,
    settings: SettingsDep,
    auth: AuthServiceDep,
) -> SessionUser:
    session_user = await auth.login(
        email=payload.email, password=payload.password.get_secret_value()
    )
    token = auth.mint_session_token(session_user.id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
        path="/",
    )
    return session_user


@router.get("/auth/me", operation_id="get_current_user", response_model=SessionUser)
async def get_current_user(current_user: CurrentUserDep) -> SessionUser:
    return current_user


@router.post("/auth/logout", operation_id="logout_user", status_code=204)
async def logout_user(response: Response, settings: SettingsDep) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
    )


__all__ = ["router"]
