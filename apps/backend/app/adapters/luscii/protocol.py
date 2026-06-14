"""Luscii adapter Protocol.

Luscii's API is vendor-shaped, not FHIR. The Protocol therefore mirrors
Luscii's own primitives. The pathway-builder programme picker does NOT go
through this Protocol — it reads the static `programs.py` constant until the
live-picker follow-up change lands.
"""

from __future__ import annotations

from datetime import date
from typing import Protocol

from app.adapters.luscii.api_models import (
    LusciiInstrumentItemLocalisation,
    LusciiInstrumentLocalisation,
    LusciiItemResponseLocalisation,
    LusciiMeasurement,
    LusciiPatientDetails,
    LusciiPlannedAction,
)


class LusciiClient(Protocol):
    async def ping(self) -> None:
        """Cheap reachability probe (`GET /v1/diagnostics/ping`). Raises on
        failure; caught by the readiness registry."""
        ...

    async def get_patient(self, luscii_patient_id: str) -> LusciiPatientDetails:
        """`GET /v1/patients/{id}`. Raises `LusciiPatientNotFoundError` on
        404/403, `LusciiApiError` on anything else unexpected."""
        ...

    async def get_planned_actions(
        self, luscii_patient_id: str, start_date: date, end_date: date
    ) -> list[LusciiPlannedAction]:
        """`GET /v1/patients/{uuid}/planned-actions`, paged to exhaustion."""
        ...

    async def get_measurements(self, start_date: date, end_date: date) -> list[LusciiMeasurement]:
        """`GET /v1/measurements` — org-wide; the caller filters by patient."""
        ...

    async def get_instrument_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiInstrumentLocalisation]:
        """`GET /v1/instrument-localisations`, paged to exhaustion.
        `expected_total` only feeds progress logging (the API has no totals)."""
        ...

    async def get_instrument_item_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiInstrumentItemLocalisation]:
        """`GET /v1/instrument-item-localisations`, paged to exhaustion."""
        ...

    async def get_item_response_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiItemResponseLocalisation]:
        """`GET /v1/instrument-item-response-localisations`, paged to exhaustion."""
        ...
