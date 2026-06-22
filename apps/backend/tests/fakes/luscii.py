"""In-memory Luscii client fake implementing the `LusciiClient` Protocol.

Configure per-test by mutating the public attributes; set `fail=True` to make
every call raise `LusciiApiError` (upstream-down simulation).
"""

from __future__ import annotations

from datetime import date

from app.adapters.luscii import (
    LusciiApiError,
    LusciiInstrumentItemLocalisation,
    LusciiInstrumentLocalisation,
    LusciiItemResponseLocalisation,
    LusciiMeasurement,
    LusciiPatientDetails,
    LusciiPatientNotFoundError,
    LusciiPlannedAction,
)
from app.adapters.luscii.api_models import LusciiAlert


class FakeLusciiClient:
    def __init__(self) -> None:
        self.patients: dict[str, LusciiPatientDetails] = {}
        self.planned_actions: list[LusciiPlannedAction] = []
        self.measurements: list[LusciiMeasurement] = []
        self.instrument_localisations: list[LusciiInstrumentLocalisation] = []
        self.instrument_item_localisations: list[LusciiInstrumentItemLocalisation] = []
        self.item_response_localisations: list[LusciiItemResponseLocalisation] = []
        self.alerts: list[LusciiAlert] = []
        self.fail = False
        # Fail only the alerts call — to exercise the non-fatal alert path
        # while the rest of the payload still resolves.
        self.alerts_fail = False
        self.calls: list[str] = []

    def _gate(self, name: str) -> None:
        self.calls.append(name)
        if self.fail:
            raise LusciiApiError(f"fake Luscii failure in {name}")

    async def ping(self) -> None:
        self._gate("ping")

    async def get_patient(self, luscii_patient_id: str) -> LusciiPatientDetails:
        self._gate("get_patient")
        patient = self.patients.get(luscii_patient_id)
        if patient is None:
            raise LusciiPatientNotFoundError(luscii_patient_id, status_code=404)
        return patient

    async def get_planned_actions(
        self, luscii_patient_id: str, start_date: date, end_date: date
    ) -> list[LusciiPlannedAction]:
        self._gate("get_planned_actions")
        return [a for a in self.planned_actions if a.patient_id == luscii_patient_id]

    async def get_measurements(self, start_date: date, end_date: date) -> list[LusciiMeasurement]:
        self._gate("get_measurements")
        return list(self.measurements)

    async def get_alerts(self, start_date: date, end_date: date) -> list[LusciiAlert]:
        self.calls.append("get_alerts")
        if self.fail or self.alerts_fail:
            raise LusciiApiError("fake Luscii failure in get_alerts")
        return list(self.alerts)

    async def get_instrument_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiInstrumentLocalisation]:
        self._gate("get_instrument_localisations")
        return list(self.instrument_localisations)

    async def get_instrument_item_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiInstrumentItemLocalisation]:
        self._gate("get_instrument_item_localisations")
        return list(self.instrument_item_localisations)

    async def get_item_response_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiItemResponseLocalisation]:
        self._gate("get_item_response_localisations")
        return list(self.item_response_localisations)

    async def aclose(self) -> None:
        # No pooled resources in the in-memory fake; matches the Protocol so
        # callers can `await client.aclose()` regardless of which client is
        # wired.
        return None
