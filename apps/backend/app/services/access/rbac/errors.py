from __future__ import annotations

from app.core.errors import AppError


class RoleNotFoundError(AppError):
    code = "not_found.role"
    status_code = 404
    message = "Role not found."


class RoleSlugConflictError(AppError):
    code = "conflict.role.slug"
    status_code = 409
    message = "A role with this slug already exists in this tenant."


class SystemRoleImmutableError(AppError):
    code = "forbidden.role.system_immutable"
    status_code = 403
    message = "System roles cannot be deleted."


class RoleInUseError(AppError):
    code = "conflict.role.in_use"
    status_code = 409
    message = "Role still has members; reassign them before deleting."


class UnknownPermissionError(AppError):
    code = "invalid.role.unknown_permission"
    status_code = 422
    message = "One or more permissions are not in the catalog."
