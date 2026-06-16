from __future__ import annotations

from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentParticipantRole
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


async def test_add_and_list_note_attributed(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    appointment = await make_appointment(
        db_session,
        tenant_id=caregiver.tenant_id,
        patient=seeded_zas_patients[0],
        actor=caregiver,
        participants=[(caregiver, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    created = await async_client.post(
        f"/appointments/{appointment.id}/notes", json={"body": "Patiënt belt morgen"}
    )
    assert created.status_code == 201, created.text
    note = created.json()
    assert note["body"] == "Patiënt belt morgen"
    assert note["author_user_id"] == str(caregiver.id)
    assert note["author_display_name"]
    assert note["created_at"]

    listed = await async_client.get(f"/appointments/{appointment.id}/notes")
    assert listed.status_code == 200, listed.text
    assert [n["body"] for n in listed.json()] == ["Patiënt belt morgen"]


async def test_note_requires_appointment_visibility(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    appointment = await make_appointment(
        db_session,
        tenant_id=admin.tenant_id,
        patient=seeded_zas_patients[0],
        actor=admin,
        participants=[(admin, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        f"/appointments/{appointment.id}/notes", json={"body": "x"}
    )
    assert response.status_code == 404


async def test_no_note_edit_or_delete_route(async_client: AsyncClient) -> None:
    # Route absence is resolved at routing time (404/405) before auth, so no
    # login is needed to prove these endpoints do not exist.
    fake = uuid4()
    patch = await async_client.patch(f"/appointments/{fake}/notes/{fake}", json={"body": "x"})
    delete = await async_client.delete(f"/appointments/{fake}/notes/{fake}")
    assert patch.status_code in (404, 405)
    assert delete.status_code in (404, 405)
