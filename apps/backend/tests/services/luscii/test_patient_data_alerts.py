"""Unit tests for the alert-flag join in the patient-data service.

Pure — exercises `_fetch_alert_flags` directly with the in-memory fake; no DB
session is touched by that path.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.adapters.luscii.api_models import LusciiAlert
from app.services.luscii.patient_data_service import LusciiPatientDataService
from tests.fakes.luscii import FakeLusciiClient

pytestmark = pytest.mark.no_db

_START = date(2026, 6, 1)
_END = date(2026, 6, 22)


def _service(client: FakeLusciiClient) -> LusciiPatientDataService:
    # The alert-fetch path never touches the session.
    return LusciiPatientDataService(session=None, client=client)  # type: ignore[arg-type]


async def test_alert_flags_keyed_by_measurement_first_wins() -> None:
    client = FakeLusciiClient()
    client.alerts = [
        LusciiAlert(id="1", measurement_id="m1", flag="red"),
        LusciiAlert(id="2", measurement_id="m1", flag="orange"),  # dropped (first wins)
        LusciiAlert(id="3", measurement_id="m2", flag="orange"),
        LusciiAlert(id="4", measurement_id=None, flag="red"),  # no measurement → ignored
        LusciiAlert(id="5", measurement_id="m3", flag=None),  # no flag → ignored
    ]
    flags = await _service(client)._fetch_alert_flags(_START, _END)
    assert flags == {"m1": "red", "m2": "orange"}


async def test_alert_fetch_failure_degrades_to_no_flags() -> None:
    client = FakeLusciiClient()
    client.alerts_fail = True
    flags = await _service(client)._fetch_alert_flags(_START, _END)
    assert flags == {}
