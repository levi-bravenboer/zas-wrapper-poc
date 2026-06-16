from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentParticipantRole
from app.db.models.appointment import AppointmentPatientAttendee
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


def _user(users: list[User], email: str) -> User:
    return next(u for u in users if u.email == email)


async def test_caregiver_lists_own_appointment(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    patient = seeded_zas_patients[0]
    appointment = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
        title="Controle",
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/appointments")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["id"] == str(appointment.id)
    assert item["patient"]["id"] == str(patient.id)
    assert item["title"] == "Controle"
    assert item["participants"][0]["role"] == "lead"


async def test_caregiver_excludes_non_participant_appointment(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=patient,
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/appointments")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0


async def test_admin_lists_tenant_wide(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    patient = seeded_zas_patients[0]
    await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/appointments")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1


async def test_detail_participant_ok_unrelated_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    patient = seeded_zas_patients[0]

    own = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    other = await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=patient,
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    ok = await async_client.get(f"/appointments/{own.id}")
    assert ok.status_code == 200, ok.text
    assert ok.json()["id"] == str(own.id)

    missing = await async_client.get(f"/appointments/{other.id}")
    assert missing.status_code == 404


async def test_patient_appointments_about_and_with(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    subject = seeded_zas_patients[0]
    other_subject = seeded_zas_patients[1]

    about = await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=subject,
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
        title="Over patient",
    )
    with_appt = await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=other_subject,
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
        title="Met patient",
    )
    db_session.add(
        AppointmentPatientAttendee(
            tenant_id=admin.tenant_id,
            appointment_id=with_appt.id,
            patient_id=subject.id,
        )
    )
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(f"/patients/{subject.id}/appointments")
    assert response.status_code == 200, response.text
    entries = {e["appointment"]["id"]: e["relation"] for e in response.json()}
    assert entries[str(about.id)] == "about"
    assert entries[str(with_appt.id)] == "with"
