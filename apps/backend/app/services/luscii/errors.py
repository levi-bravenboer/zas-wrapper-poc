from __future__ import annotations

from app.core.errors import AppError


class LusciiProgramNotFoundError(AppError):
    code = "not-found.luscii.program"
    status_code = 404
    message = "Luscii program not found."

    def __init__(self, program_id: str) -> None:
        super().__init__(
            message=self.message,
            details={"program_id": program_id},
        )


class LusciiNotConfiguredError(AppError):
    """No BACKEND_LUSCII_API_TOKEN ⇒ Luscii endpoints are switched off."""

    code = "unavailable.luscii.not_configured"
    status_code = 503
    message = "Luscii integration is not configured."


class LusciiUnavailableError(AppError):
    """Upstream Luscii failure (transport, 5xx, malformed payload)."""

    code = "unavailable.luscii.upstream"
    status_code = 502
    message = "Luscii is unreachable or returned an unexpected response."


class LusciiLinkPatientNotFoundError(AppError):
    """Link validation: Luscii answered 404/403 for the supplied UUID."""

    code = "invalid.luscii.patient_not_found"
    status_code = 422
    message = "Luscii patient not found or not accessible with our token."


class LusciiIdAlreadyLinkedError(AppError):
    """The supplied Luscii UUID is actively linked to a different patient."""

    code = "conflict.luscii.already_linked"
    status_code = 409
    message = "This Luscii patient is already linked to another patient."
