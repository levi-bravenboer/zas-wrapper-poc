from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.audit import ActorType, AuditAction, AuditResult, PurposeOfUse
from app.db.models.user import User
from scripts.seed_tenant import ZAS_TENANT_ID
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


async def test_requires_admin_role(async_client: AsyncClient, seeded_zas_users: list[User]) -> None:
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.get("/audit-events")

    assert response.status_code == 403


async def test_admin_lists_audit_events(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/audit-events")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body and "total" in body


async def test_admin_login_is_recorded_and_filterable(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get(
        "/audit-events",
        params={"filter[event_code][eq]": "auth.login", "filter[result][eq]": "success"},
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert items, "admin login should have produced an auth.login/success audit event"
    # login now writes FHIR `action=execute` + `event_code=auth.login` (legacy
    # `login` action deprecated); outcome stays the orthogonal `result`.
    assert all(item["event_code"] == "auth.login" for item in items)
    assert all(item["action"] == "execute" for item in items)
    assert all(item["result"] == "success" for item in items)


def test_audit_events_has_no_write_operations(app: FastAPI) -> None:
    methods = set(app.openapi()["paths"]["/audit-events"].keys())
    assert methods == {"get"}


async def _seed_event(
    session: AsyncSession,
    *,
    patient_id: UUID,
    purpose: PurposeOfUse,
) -> None:
    from app.db.models.audit.audit_event import AuditEvent

    session.add(
        AuditEvent(
            actor_type=ActorType.USER,
            tenant_id=ZAS_TENANT_ID,
            action=AuditAction.READ,
            result=AuditResult.SUCCESS,
            event_code="patient.dossier_viewed",
            resource_type="Patient",
            resource_id=patient_id,
            patient_id=patient_id,
            purpose_of_use=purpose,
        )
    )
    await session.commit()


async def test_filter_by_patient_id_and_break_the_glass(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    patient_a, patient_b = uuid4(), uuid4()
    await _seed_event(db_session, patient_id=patient_a, purpose=PurposeOfUse.TREATMENT)
    await _seed_event(db_session, patient_id=patient_b, purpose=PurposeOfUse.TREATMENT)
    await _seed_event(db_session, patient_id=patient_a, purpose=PurposeOfUse.BREAK_THE_GLASS)
    await _login(async_client, ADMIN_EMAIL)

    # Patient-centric query: all dossier access for patient A.
    by_patient = await async_client.get(
        "/audit-events", params={"filter[patient_id][eq]": str(patient_a)}
    )
    assert by_patient.status_code == 200
    items = by_patient.json()["items"]
    assert len(items) == 2
    assert all(item["patient_id"] == str(patient_a) for item in items)

    # Break-the-glass override access is isolable.
    by_purpose = await async_client.get(
        "/audit-events", params={"filter[purpose_of_use][eq]": "break_the_glass"}
    )
    assert by_purpose.status_code == 200
    glass = by_purpose.json()["items"]
    assert len(glass) == 1
    assert glass[0]["patient_id"] == str(patient_a)
    assert glass[0]["purpose_of_use"] == "break_the_glass"
