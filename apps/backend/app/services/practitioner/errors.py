from __future__ import annotations

from app.core.errors import AppError


class PractitionerNotFoundError(AppError):
    code = "not-found.practitioner.not_found"
    status_code = 404
    message = "Practitioner not found."


class PractitionerAlreadyExistsError(AppError):
    code = "conflict.practitioner.already_exists"
    status_code = 409
    message = "Practitioner already exists for this user."


class UserNotCaregiverError(AppError):
    code = "invalid.practitioner.user_not_caregiver"
    status_code = 422
    message = "Only users with role=caregiver may have a Practitioner record."


class CrossTenantPractitionerError(AppError):
    code = "forbidden.practitioner.cross_tenant"
    status_code = 403
    message = "Cross-tenant practitioner access is forbidden."
