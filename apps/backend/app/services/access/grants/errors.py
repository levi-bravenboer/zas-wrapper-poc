from __future__ import annotations

from app.core.errors import AppError


class BreakGlassReasonRequiredError(AppError):
    code = "invalid.access_grant.reason_required"
    status_code = 422
    message = "Break-glass access requires a non-empty reason."


class BreakGlassDurationError(AppError):
    code = "invalid.access_grant.duration_exceeds_cap"
    status_code = 422
    message = "Requested duration exceeds the break-glass cap."


class AccessGrantNotFoundError(AppError):
    code = "not-found.access_grant.not_found"
    status_code = 404
    message = "Access grant not found."


class ConsentNotFoundError(AppError):
    code = "not-found.consent.not_found"
    status_code = 404
    message = "Consent not found."


class ConsentNotActiveError(AppError):
    code = "invalid.consent.not_active"
    status_code = 422
    message = "The referenced consent is not active."


class ExternalGrantNotFoundError(AppError):
    code = "not-found.external_grant.not_found"
    status_code = 404
    message = "External grant not found."
