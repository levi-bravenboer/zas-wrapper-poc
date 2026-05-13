from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUserDep, SessionSignerDep
from app.core.errors import AppError, ErrorResponse
from app.core.security import DEFAULT_SESSION_MAX_AGE_SECONDS
from app.core.settings import SettingsDep
from app.schemas.auth import LoginRequest, SessionUser
from app.services import auth_service

router = APIRouter(tags=["auth"])


def _set_session_cookie(response: Response, settings, value: str, max_age: int) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=value,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
        path="/",
    )


@router.post(
    "/login",
    operation_id="post_auth_login",
    response_model=SessionUser,
    responses={401: {"model": ErrorResponse}},
)
def login(
    payload: LoginRequest,
    response: Response,
    signer: SessionSignerDep,
    settings: SettingsDep,
) -> SessionUser:
    user = auth_service.authenticate(payload.username, payload.password)
    if user is None:
        raise AppError(
            code="auth.invalid_credentials",
            status_code=401,
            message="Invalid username or password.",
        )
    token = signer.sign(user.id)
    _set_session_cookie(response, settings, token, DEFAULT_SESSION_MAX_AGE_SECONDS)
    return user


@router.get(
    "/me",
    operation_id="get_auth_me",
    response_model=SessionUser,
    responses={401: {"model": ErrorResponse}},
)
def me(current_user: CurrentUserDep) -> SessionUser:
    return current_user


@router.post(
    "/logout",
    operation_id="post_auth_logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def logout(response: Response, settings: SettingsDep) -> Response:
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


__all__ = ["router"]
