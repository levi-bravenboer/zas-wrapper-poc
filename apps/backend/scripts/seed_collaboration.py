# SYNTHETIC ONLY — see openspec/project.md no-PHI invariant.
#
# Seeds a couple of demo notes across owners (one on an appointment, one
# directly on the patient) so the collaboration panels + the patient
# "Notities & documenten" aggregate show data in the demo. Idempotent on
# (owner_type, owner_id, body). Attachments are not seeded (they need real
# object-storage bytes; an empty metadata row would 404 on download).

"""Idempotent seed of demo collaboration notes under the `zas` tenant."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentStatus
from app.core.enums.collaboration import OwnerType
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.appointment import Appointment
from app.db.models.collaboration import Note
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

logger = logging.getLogger(__name__)


class _SeedMissingError(RuntimeError):
    """Raised when prerequisites (tenant/users/appointment) are missing."""


async def seed_collaboration(session: AsyncSession) -> list[Note]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise _SeedMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")
    user_repo = UserRepository(session)
    admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
    caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
    if admin is None or caregiver is None:
        raise _SeedMissingError("admin/caregiver missing — run seed_users first")

    appointment = (
        await session.execute(
            select(Appointment)
            .where(
                Appointment.tenant_id == tenant.id,
                Appointment.status == AppointmentStatus.BOOKED,
                Appointment.deleted_at.is_(None),
            )
            .order_by(Appointment.starts_at)
            .limit(1)
        )
    ).scalar_one_or_none()
    if appointment is None:
        logger.info("seed_collaboration: no appointments — run seed_appointments first")
        return []

    demo: list[tuple[OwnerType, object, object, str]] = [
        (OwnerType.APPOINTMENT, appointment.id, appointment.patient_id, "Patiënt belde voor extra uitleg — opgevolgd."),
        (OwnerType.PATIENT, appointment.patient_id, appointment.patient_id, "Algemene notitie over deze patiënt."),
    ]

    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=admin.id, email=admin.email, display_name=admin.display_name,
        tenant_id=admin.tenant_id, role=admin.role,
    )
    try:
        seeded: list[Note] = []
        for owner_type, owner_id, patient_id, body in demo:
            existing = (
                await session.execute(
                    select(Note).where(
                        Note.tenant_id == tenant.id,
                        Note.owner_type == owner_type,
                        Note.owner_id == owner_id,
                        Note.body == body,
                        Note.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                seeded.append(existing)
                continue
            note = Note(
                owner_type=owner_type,
                owner_id=owner_id,
                patient_id=patient_id,
                author_user_id=caregiver.id,
                body=body,
            )
            session.add(note)
            await session.flush()
            seeded.append(note)
            logger.info("seeded %s note on %s", owner_type.value, owner_id)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return seeded


async def _seed(session: AsyncSession) -> None:
    await seed_collaboration(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
