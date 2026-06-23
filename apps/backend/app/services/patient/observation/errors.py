from __future__ import annotations

from app.core.errors import AppError


class UnsupportedObservationTypeError(AppError):
    """POST /patients/{id}/observations: measurement type is not on the
    server-side allow-list. The set of accepted types is intentionally small
    (heart rate only for now)."""

    code = "invalid.observation.unsupported_type"
    status_code = 422
    message = "Measurement type is not supported."
