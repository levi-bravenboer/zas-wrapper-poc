from __future__ import annotations

from app.core.errors import AppError


class UserNotFoundError(AppError):
    code = "not-found.user.not_found"
    status_code = 404
    message = "User not found."


class CrossTenantAccessError(AppError):
    code = "forbidden.user.cross_tenant"
    status_code = 403
    message = "Cross-tenant user access is forbidden."
