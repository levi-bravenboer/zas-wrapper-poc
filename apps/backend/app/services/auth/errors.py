from __future__ import annotations

from app.core.errors import AppError


class InvalidCredentialsError(AppError):
    code = "security.auth.invalid_credentials"
    status_code = 401
    message = "Invalid email or password."


class UnauthenticatedError(AppError):
    code = "security.auth.unauthenticated"
    status_code = 401
    message = "Authentication required."


class ForbiddenRoleError(AppError):
    code = "forbidden.auth.role"
    status_code = 403
    message = "Caller role is not permitted for this resource."
