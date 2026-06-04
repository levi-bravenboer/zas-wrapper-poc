from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.errors import AppError

if TYPE_CHECKING:
    from app.services.access.identity.audit import AuthFailureReason


class InvalidCredentialsError(AppError):
    code = "security.auth.invalid_credentials"
    status_code = 401
    message = "Invalid email or password."

    def __init__(
        self,
        *,
        audit_reason: AuthFailureReason | None = None,
        audit_user_id: UUID | None = None,
    ) -> None:
        super().__init__()
        self.audit_reason: AuthFailureReason | None = audit_reason
        self.audit_user_id = audit_user_id


class UnauthenticatedError(AppError):
    code = "security.auth.unauthenticated"
    status_code = 401
    message = "Authentication required."


class ForbiddenRoleError(AppError):
    code = "forbidden.auth.role"
    status_code = 403
    message = "Caller role is not permitted for this resource."
