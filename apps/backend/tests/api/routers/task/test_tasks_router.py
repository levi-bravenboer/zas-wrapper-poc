from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.db.models.patient import Patient
from app.db.models.user import User
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL
from tests.fixtures.appointment_factory import make_appointment

_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _PASSWORD}
    )
    assert response.status_code == 200, response.text


def _caregiver(users: list[User]) -> User:
    return next(u for u in users if u.email == CAREGIVER_EMAIL)


def _admin(users: list[User]) -> User:
    return next(u for u in users if u.email == ADMIN_EMAIL)


# ── envelope ─────────────────────────────────────────────────────────────


async def test_envelope_shape_for_appointment_source(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    appointment = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        title="Controle",
        kind=AppointmentKind.CONSULTATION,
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["id"] == str(appointment.id)
    assert item["source"] == "appointment"
    assert item["source_id"] == str(appointment.id)
    assert item["title"] == "Controle"
    assert item["kind"] == "consultation"
    assert item["priority"] is None
    assert "patient" not in item, "No top-level patient field on envelope"
    assert item["payload"]["id"] == str(appointment.id)
    assert item["payload"]["patient"]["id"] == str(patient.id)
    assert item["payload"]["patient"]["family_name"] == patient.family_name
    assert item["payload"]["patient"]["given_name"] == patient.given_name
    assert item["payload"]["kind"] == "consultation"
    assert item["payload"]["modality"] == "online"
    assert item["payload"]["status"] == "booked"
    assert len(item["payload"]["participants"]) == 1
    assert item["payload"]["participants"][0]["role"] == "lead"
    assert item["payload"]["participants"][0]["user_display_name"]


# ── window ───────────────────────────────────────────────────────────────


async def test_appointment_beyond_30d_window_excluded(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    far = datetime.now(UTC) + timedelta(days=35)
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        starts_at=far,
        ends_at=far + timedelta(hours=1),
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_appointment_within_30d_window_included(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    mid_window = datetime.now(UTC) + timedelta(days=5)
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        starts_at=mid_window,
        ends_at=mid_window + timedelta(hours=1),
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200
    assert response.json()["total"] == 1


async def test_appointment_non_booked_status_excluded(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        status=AppointmentStatus.CANCELLED,
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.json()["total"] == 0


async def test_past_appointment_excluded(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    past = datetime.now(UTC) - timedelta(hours=1)
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        starts_at=past,
        ends_at=past + timedelta(minutes=30),
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.json()["total"] == 0


async def test_within_query_param_silently_ignored(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    far = datetime.now(UTC) + timedelta(days=40)
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        starts_at=far,
        ends_at=far + timedelta(hours=1),
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks", params={"within": "90d"})
    # Param ignored — 30d window still applies, far appointment stays excluded.
    assert response.status_code == 200
    assert response.json()["total"] == 0


# ── visibility ───────────────────────────────────────────────────────────


async def test_caregiver_sees_only_own_participations(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    admin = _admin(seeded_zas_users)
    patient = seeded_zas_patients[0]
    # caregiver participant
    mine = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        title="mine",
    )
    # admin-only participant — caregiver is NOT on it
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
        title="theirs",
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert ids == {str(mine.id)}


async def test_admin_same_participant_predicate_no_bypass(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    # caregiver-only participant
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200
    assert response.json()["total"] == 0, "Admin gets own participations only"


async def test_get_one_lost_participation_returns_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    appointment = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    # soft-delete the caregiver's participation row
    from app.db.models.appointment import AppointmentParticipant
    from sqlalchemy import select

    participant = (
        await db_session.execute(
            select(AppointmentParticipant).where(
                AppointmentParticipant.appointment_id == appointment.id,
                AppointmentParticipant.user_id == caregiver.id,
            )
        )
    ).scalar_one()
    participant.deleted_at = datetime.now(UTC)
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(f"/tasks/appointment/{appointment.id}")
    assert response.status_code == 404


# ── sort ─────────────────────────────────────────────────────────────────


async def test_default_sort_is_due_at_asc(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    later = datetime.now(UTC) + timedelta(days=2)
    earlier = datetime.now(UTC) + timedelta(hours=2)
    a_later = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        starts_at=later,
        ends_at=later + timedelta(hours=1),
        title="later",
    )
    a_earlier = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        starts_at=earlier,
        ends_at=earlier + timedelta(hours=1),
        title="earlier",
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(a_earlier.id), str(a_later.id)]


@pytest.mark.parametrize(
    "params,expected_status",
    [
        ({"order_by": "created_at"}, 422),
        ({"order": "desc"}, 422),
        ({"q": "anything"}, 422),
    ],
)
async def test_unsupported_query_rejected(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
    params: dict[str, str],
    expected_status: int,
) -> None:
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks", params=params)
    assert response.status_code == expected_status


# ── filter ───────────────────────────────────────────────────────────────


async def test_filter_patient_id_restricts(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient_a = seeded_zas_patients[0]
    patient_b = seeded_zas_patients[1]
    a = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient_a,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient_b,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(
        "/tasks", params={"filter[patient_id][eq]": str(patient_a.id)}
    )
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(a.id)]


async def test_filter_unknown_field_rejected(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks", params={"filter[status][eq]": "booked"})
    assert response.status_code == 422


# ── auth ─────────────────────────────────────────────────────────────────


async def test_unauthenticated_rejected(async_client: AsyncClient) -> None:
    response = await async_client.get("/tasks")
    assert response.status_code == 401


# ── get-one ──────────────────────────────────────────────────────────────


async def test_get_unknown_source_returns_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    del db_session, seeded_zas_patients
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)
    import uuid

    response = await async_client.get(f"/tasks/notes/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_one_round_trip(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _caregiver(seeded_zas_users)
    patient = seeded_zas_patients[0]
    appointment = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(f"/tasks/appointment/{appointment.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(appointment.id)
    assert body["source"] == "appointment"
