from __future__ import annotations

from app.adapters.hix._fixtures import get_patient
from app.core.errors import AppError
from app.schemas.fhir import Patient


class HixStubClient:
    """In-memory HiX stub. POC ONLY — never used in production paths."""

    async def ping(self) -> None:
        return None

    async def get_patient(self, reference: str) -> Patient:
        patient = get_patient(reference)
        if patient is None:
            raise AppError(
                code="not-found.hix.patient",
                status_code=404,
                message=f"Unknown HiX patient reference: {reference}",
            )
        return patient
