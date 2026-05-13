from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.core.errors import AppError
from app.core.security import SessionSigner
from app.core.settings import SettingsDep
from app.schemas.auth import SessionUser
from app.services import auth_service


def get_session_signer(request: Request) -> SessionSigner:
    signer = getattr(request.app.state, "session_signer", None)
    if signer is None:
        raise RuntimeError("SessionSigner not configured on app.state")
    return signer


SessionSignerDep = Annotated[SessionSigner, Depends(get_session_signer)]


def get_current_user(
    request: Request,
    settings: SettingsDep,
    signer: SessionSignerDep,
) -> SessionUser:
    cookie = request.cookies.get(settings.session_cookie_name)
    if cookie is None:
        raise AppError(code="auth.unauthenticated", status_code=401, message="No session cookie.")
    user_id = signer.unsign(cookie)
    if user_id is None:
        raise AppError(
            code="auth.unauthenticated", status_code=401, message="Invalid session cookie."
        )
    user = auth_service.get_user(user_id)
    if user is None:
        raise AppError(
            code="auth.unauthenticated", status_code=401, message="Session user not found."
        )
    return user


CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]
