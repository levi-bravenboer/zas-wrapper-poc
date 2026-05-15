from __future__ import annotations

from app.core.errors import AppError


class PatientNotFoundError(AppError):
    code = "not-found.patient.not_found"
    status_code = 404
    message = "Patient not found."


class PatientIdentifiersImmutableError(AppError):
    """PATCH /patients/{id} rejects identifier mutation in patients-base."""

    code = "invalid.patient.identifiers_immutable"
    status_code = 422
    message = "Identifiers cannot be mutated via PATCH; use the dedicated endpoint when available."
