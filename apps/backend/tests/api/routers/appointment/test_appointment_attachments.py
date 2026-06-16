from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentParticipantRole
from app.db.models.patient import Patient
from app.db.models.user import User
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL
from tests.fixtures.appointment_factory import make_appointment

_PASSWORD = "changeme"
_50MB = 50 * 1024 * 1024


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _PASSWORD}
    )
    assert response.status_code == 200, response.text


def _user(users: list[User], email: str) -> User:
    return next(u for u in users if u.email == email)


async def _appointment_for(db_session: AsyncSession, *, user: User, patient: Patient):
    appt = await make_appointment(
        db_session,
        tenant_id=user.tenant_id,
        patient=patient,
        actor=user,
        participants=[(user, AppointmentParticipantRole.LEAD)],
    )
    await db_session.commit()
    return appt


async def test_upload_returns_presigned_url_and_metadata(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    appt = await _appointment_for(db_session, user=caregiver, patient=seeded_zas_patients[0])

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        f"/appointments/{appt.id}/attachments",
        json={"filename": "verwijsbrief.pdf", "content_type": "application/pdf", "size": 1024},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["upload_url"].startswith("http")
    assert body["attachment"]["filename"] == "verwijsbrief.pdf"
    assert body["attachment"]["uploaded_by"] == str(caregiver.id)
    assert body["attachment"]["uploader_display_name"]

    listed = await async_client.get(f"/appointments/{appt.id}/attachments")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_oversize_rejected(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    appt = await _appointment_for(db_session, user=caregiver, patient=seeded_zas_patients[0])

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        f"/appointments/{appt.id}/attachments",
        json={"filename": "big.bin", "content_type": "application/octet-stream", "size": _50MB + 1},
    )
    assert response.status_code == 422
    listed = await async_client.get(f"/appointments/{appt.id}/attachments")
    assert listed.json() == []


async def test_download_url_and_uploader_only_delete(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
    seeded_zas_patients: list[Patient],
) -> None:
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    # Appointment both can see: caregiver lead + admin tenant-wide.
    appt = await _appointment_for(db_session, user=caregiver, patient=seeded_zas_patients[0])

    await _login(async_client, CAREGIVER_EMAIL)
    created = await async_client.post(
        f"/appointments/{appt.id}/attachments",
        json={"filename": "a.pdf", "content_type": "application/pdf", "size": 10},
    )
    attachment_id = created.json()["attachment"]["id"]

    url = await async_client.get(f"/appointments/{appt.id}/attachments/{attachment_id}/url")
    assert url.status_code == 200
    assert url.json()["url"].startswith("http")

    # Admin (not the uploader) cannot delete.
    await _login(async_client, ADMIN_EMAIL)
    forbidden = await async_client.delete(f"/appointments/{appt.id}/attachments/{attachment_id}")
    assert forbidden.status_code in (403, 404)

    # Uploader can.
    await _login(async_client, CAREGIVER_EMAIL)
    deleted = await async_client.delete(f"/appointments/{appt.id}/attachments/{attachment_id}")
    assert deleted.status_code == 204
    listed = await async_client.get(f"/appointments/{appt.id}/attachments")
    assert listed.json() == []
