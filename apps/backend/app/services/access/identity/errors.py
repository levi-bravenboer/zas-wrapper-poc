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


class ForbiddenPermissionError(AppError):
    code = "forbidden.auth.permission"
    status_code = 403
    message = "Caller lacks the required permission for this resource."


class PrivilegeEscalationError(AppError):
    """Role-management write would amplify privilege or touch a crown
    permission / system role without the admin role (D7/D7a)."""

    code = "forbidden.auth.privilege_escalation"
    status_code = 403
    message = "This role or permission change exceeds your privileges."


class RoleSelectionRequiredError(AppError):
    """Multi-role session without an active-role binding (REQ-NON-3)."""

    code = "conflict.auth.role_selection_required"
    status_code = 409
    message = "Select an active role for this session."


class RoleNotAvailableError(AppError):
    code = "invalid.auth.role_not_available"
    status_code = 422
    message = "The requested role is not available for this account."
