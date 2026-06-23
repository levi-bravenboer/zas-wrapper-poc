"""Manual measurement entry (`POST/GET /patients/{id}/observations`) tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.patient import Observation, Patient
from scripts.seed_users import ADMIN_EMAIL

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


def _url(patient: Patient) -> str:
    return f"/patients/{patient.id}/observations"


async def test_create_heart_rate_persists_with_server_derived_coding(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    db_session: AsyncSession,
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    response = await async_client.post(
        _url(patient),
        json={"measurement_type": "heart_rate", "value": "72"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["patient_id"] == str(patient.id)
    assert body["code"] == "8867-4"
    assert body["code_system"] == "http://loinc.org"
    assert body["unit"] == "beats/min"
    assert body["value"] == "72.000"
    assert body["effective_date_time"]
    assert body["performer_id"]
    assert body["performer_display_name"]

    persisted = (
        await db_session.execute(select(Observation).where(Observation.patient_id == patient.id))
    ).scalar_one()
    assert persisted.code == "8867-4"
    assert persisted.unit == "beats/min"


async def test_create_unsupported_type_returns_422(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    db_session: AsyncSession,
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    response = await async_client.post(
        _url(patient),
        json={"measurement_type": "blood_pressure", "value": "120"},
    )
    assert response.status_code == 422
    # `measurement_type` is a StrEnum on the schema, so an unknown value is
    # rejected at the request-validation layer with FastAPI's standard 422.
    count = (
        await db_session.execute(select(Observation).where(Observation.patient_id == patient.id))
    ).all()
    assert count == []


async def test_create_ignores_client_supplied_coding(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    response = await async_client.post(
        _url(patient),
        json={
            "measurement_type": "heart_rate",
            "value": "65",
            "code": "wrong-code",
            "unit": "mmHg",
        },
    )
    # `ObservationCreate.extra="forbid"` blocks unknown fields with 422.
    assert response.status_code == 422


async def test_list_returns_observations_newest_first(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    now = datetime.now(UTC)
    for offset_min, val in ((10, "60"), (0, "75"), (5, "70")):
        response = await async_client.post(
            _url(patient),
            json={
                "measurement_type": "heart_rate",
                "value": val,
                "effective_date_time": (now - timedelta(minutes=offset_min)).isoformat(),
            },
        )
        assert response.status_code == 201, response.text

    response = await async_client.get(_url(patient))
    assert response.status_code == 200
    rows = response.json()
    assert [r["value"] for r in rows] == ["75.000", "70.000", "60.000"]


async def test_endpoints_require_patient_access(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
) -> None:
    patient = seeded_zas_patients[0]
    # No login → auth middleware refuses (401/403, never 201/200).
    create = await async_client.post(
        _url(patient), json={"measurement_type": "heart_rate", "value": "70"}
    )
    assert create.status_code in (401, 403)
    listing = await async_client.get(_url(patient))
    assert listing.status_code in (401, 403)
