from __future__ import annotations

from httpx import AsyncClient

from app.db.models.patient import Patient
from scripts.seed_users import ADMIN_EMAIL

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


async def test_order_by_next_appointment_starts_at_rejected(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    """Regression guard: the previously-considered `next_appointment_starts_at`
    sort key was never added to `PatientRepository.allowed_order_by` — the
    task aggregator at `GET /tasks` owns appointment-derived ordering."""

    del seeded_zas_patients
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(
        "/patients", params={"order_by": "next_appointment_starts_at"}
    )
    assert response.status_code == 422


async def test_order_by_unknown_field_rejected(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/patients", params={"order_by": "banana"})
    assert response.status_code == 422
