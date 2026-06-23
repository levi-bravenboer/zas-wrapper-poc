from __future__ import annotations

from app.core.errors import AppError


class UnsupportedObservationTypeError(AppError):
    """POST /patients/{id}/observations: measurement type is not on the
    server-side allow-list."""

    code = "invalid.observation.unsupported_type"
    status_code = 422
    message = "Measurement type is not supported."


class MissingSecondaryValueError(AppError):
    """POST /patients/{id}/observations: a composite type (e.g. blood
    pressure) was selected but the secondary value was not provided."""

    code = "invalid.observation.secondary_value_required"
    status_code = 422
    message = "This measurement type requires a second value."


class UnexpectedSecondaryValueError(AppError):
    """POST /patients/{id}/observations: a single-value type was selected but
    a secondary value was supplied."""

    code = "invalid.observation.secondary_value_not_allowed"
    status_code = 422
    message = "This measurement type does not accept a second value."
