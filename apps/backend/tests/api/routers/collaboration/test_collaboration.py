from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentParticipantRole
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.patient import Patient
from app.db.models.user import User
from app.repositories.task import TaskRepository
from app.schemas.auth.auth import SessionUser
from app.services.task.task_service import TaskService
from scripts.seed_care_teams import seed_care_teams
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL
from tests.fixtures.appointment_factory import make_appointment

_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    r = await client.post("/auth/login/password", json={"email": email, "password": _PASSWORD})
    assert r.status_code == 200, r.text


def _user(users: list[User], email: str) -> User:
    return next(u for u in users if u.email == email)


async def _make_task(session: AsyncSession, *, actor: User, assignee: User, patient_id):  # type: ignore[no-untyped-def]
    prev = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=actor.id, email=actor.email, display_name=actor.display_name,
        tenant_id=actor.tenant_id, role=actor.role,
    )
    try:
        task = await TaskService(TaskRepository(session), session).create(
            assignee_user_id=assignee.id, title="Taak", patient_id=patient_id
        )
        await session.commit()
        return task
    finally:
        if prev is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = prev


async def test_note_on_appointment_and_patient_aggregate(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    appt = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()
    task = await _make_task(db_session, actor=admin, assignee=caregiver, patient_id=patient.id)

    await _login(async_client, CAREGIVER_EMAIL)
    # note on appointment
    r1 = await async_client.post(f"/appointments/{appt.id}/notes", json={"body": "Op afspraak"})
    assert r1.status_code == 201, r1.text
    assert r1.json()["owner_type"] == "appointment"
    # note on task
    r2 = await async_client.post(f"/tasks/{task.id}/notes", json={"body": "Op taak"})
    assert r2.status_code == 201, r2.text
    assert r2.json()["owner_type"] == "task"

    # patient aggregate spans owners (read as admin — tenant-wide patient access)
    await _login(async_client, ADMIN_EMAIL)
    agg = await async_client.get(f"/patients/{patient.id}/notes")
    assert agg.status_code == 200, agg.text
    owners = {n["owner_type"] for n in agg.json()}
    assert {"appointment", "task"} <= owners


async def test_care_team_caregiver_can_author_without_being_participant(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    # Caregiver is a care-team member of the patient but NOT an appointment
    # participant — authorship is granted via the patient-access fallback in
    # AppointmentAccessDep (resolve_patient_with_relation), not participation.
    await seed_care_teams(db_session)
    await db_session.commit()
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    patient = seeded_zas_patients[0]
    appt = await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=patient,
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    r = await async_client.post(f"/appointments/{appt.id}/notes", json={"body": "Via zorgteam"})
    assert r.status_code == 201, r.text
    assert r.json()["author_user_id"] == str(
        _user(seeded_zas_users, CAREGIVER_EMAIL).id
    )


async def test_task_without_patient_allows_note_with_null_patient(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    del seeded_zas_patients
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    task = await _make_task(db_session, actor=admin, assignee=caregiver, patient_id=None)

    await _login(async_client, CAREGIVER_EMAIL)
    r = await async_client.post(f"/tasks/{task.id}/notes", json={"body": "x"})
    assert r.status_code == 201, r.text
    assert r.json()["patient_id"] is None


async def test_attachment_upload_and_uploader_delete(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    patient = seeded_zas_patients[0]
    appt = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=patient,
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    created = await async_client.post(
        f"/appointments/{appt.id}/attachments",
        json={"filename": "brief.pdf", "content_type": "application/pdf", "size": 1024},
    )
    assert created.status_code == 201, created.text
    assert created.json()["upload_url"].startswith("http")
    att_id = created.json()["attachment"]["id"]

    listed = await async_client.get(f"/appointments/{appt.id}/attachments")
    assert len(listed.json()) == 1
    # patient aggregate includes it (read as admin — tenant-wide patient access)
    await _login(async_client, ADMIN_EMAIL)
    agg = await async_client.get(f"/patients/{patient.id}/attachments")
    assert any(a["id"] == att_id for a in agg.json())

    await _login(async_client, CAREGIVER_EMAIL)
    deleted = await async_client.delete(f"/appointments/{appt.id}/attachments/{att_id}")
    assert deleted.status_code == 204
    assert (await async_client.get(f"/appointments/{appt.id}/attachments")).json() == []
