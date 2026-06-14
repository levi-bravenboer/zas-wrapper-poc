"""Typed errors raised by the Luscii adapter.

Transport-layer errors only; routes map them to `AppError` responses in the
service layer. Messages MUST never contain the bearer token or raw upstream
bodies.
"""

from __future__ import annotations


class LusciiApiError(Exception):
    """Unexpected upstream behaviour: non-2xx status, transport failure,
    malformed payload, or pagination runaway."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class LusciiPatientNotFoundError(LusciiApiError):
    """Luscii answered 404 (or 403 — token lacks access) for a patient id."""

    def __init__(self, luscii_patient_id: str, *, status_code: int) -> None:
        super().__init__(
            f"Luscii patient {luscii_patient_id} not found or not accessible",
            status_code=status_code,
        )
        self.luscii_patient_id = luscii_patient_id
