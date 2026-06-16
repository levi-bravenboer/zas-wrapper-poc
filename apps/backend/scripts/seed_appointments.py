# SYNTHETIC ONLY — see openspec/project.md no-PHI invariant.
#
# Seeds a handful of BOOKED appointments for the demo caregiver so the
# `/tasks` aggregator has rows to project. Each appointment has the demo
# caregiver as its single `lead` participant — the exact link the task
# window query keys off (`AppointmentParticipant.user_id == caller`).
#
# starts_at is anchored to `now()` so every run lands inside the 30-day
# task window. Idempotency keys on `(patient_id, title)` for an open row;
# a re-run refreshes `starts_at`/`ends_at` so the demo data never drifts
# out of the window.

"""Idempotent seed of demo appointments (caregiver tasks) for the `zas` tenant."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.appointment import Appointment, AppointmentParticipant
from app.db.models.patient import Patient
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Template:
    title: str
    kind: AppointmentKind
    modality: AppointmentModality
    location_text: str | None
    # Offset of the appointment start from `now()`, and its duration.
    starts_in: timedelta
    duration: timedelta


# One template per slot; spread across the 30-day window and the kind /
# modality axes so the task list shows variety.
_TEMPLATES: tuple[_Template, ...] = (
    _Template(
        title="Controle consult — Rugrevalidatie",
        kind=AppointmentKind.CONSULTATION,
        modality=AppointmentModality.ON_SITE,
        location_text="ZAS Campus Stuivenberg — Polikliniek 3",
        starts_in=timedelta(days=1, hours=2),
        duration=timedelta(minutes=30),
    ),
    _Template(
        title="Teleconsult — opvolging klachten",
        kind=AppointmentKind.CONSULTATION,
        modality=AppointmentModality.ONLINE,
        location_text=None,
        starts_in=timedelta(days=3, hours=4),
        duration=timedelta(minutes=20),
    ),
    _Template(
        title="Bloedafname — controle ontsteking",
        kind=AppointmentKind.LAB,
        modality=AppointmentModality.ON_SITE,
        location_text="ZAS Campus Stuivenberg — Labo",
        starts_in=timedelta(days=6, hours=1),
        duration=timedelta(minutes=15),
    ),
    _Template(
        title="MRI onderrug",
        kind=AppointmentKind.IMAGING,
        modality=AppointmentModality.ON_SITE,
        location_text="ZAS Campus Sint-Augustinus — Radiologie",
        starts_in=timedelta(days=10, hours=3),
        duration=timedelta(minutes=45),
    ),
    _Template(
        title="Intake gesprek — revalidatieplan",
        kind=AppointmentKind.OTHER,
        modality=AppointmentModality.ONLINE,
        location_text=None,
        starts_in=timedelta(days=14, hours=5),
        duration=timedelta(minutes=40),
    ),
)


class _ZasTenantMissingError(RuntimeError):
    """Raised when `seed_appointments` runs before the `zas` tenant exists."""


class _SeedUserMissingError(RuntimeError):
    """Raised when `seed_appointments` runs before the admin/caregiver exist."""


async def seed_appointments(session: AsyncSession) -> list[Appointment]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise _ZasTenantMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    user_repo = UserRepository(session)
    admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
    caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
    if admin is None or caregiver is None:
        raise _SeedUserMissingError("admin/caregiver missing — run seed_users first")

    patients = (
        (
            await session.execute(
                select(Patient)
                .where(Patient.tenant_id == tenant.id, Patient.deleted_at.is_(None))
                .order_by(Patient.created_at, Patient.id)
                .limit(len(_TEMPLATES))
            )
        )
        .scalars()
        .all()
    )
    if not patients:
        logger.warning("no patients found — run seed_patients first; nothing to seed")
        return []

    now = datetime.now(UTC)
    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )
    try:
        seeded: list[Appointment] = []
        for patient, template in zip(patients, _TEMPLATES, strict=False):
            appointment = await _get_or_create_appointment(
                session,
                tenant_id=tenant.id,
                patient_id=patient.id,
                caregiver_id=caregiver.id,
                template=template,
                now=now,
            )
            seeded.append(appointment)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return seeded


async def _get_or_create_appointment(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    caregiver_id: UUID,
    template: _Template,
    now: datetime,
) -> Appointment:
    starts_at = now + template.starts_in
    ends_at = starts_at + template.duration

    existing = (
        await session.execute(
            select(Appointment).where(
                Appointment.tenant_id == tenant_id,
                Appointment.patient_id == patient_id,
                Appointment.title == template.title,
                Appointment.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        # Refresh the window so a re-run never drifts the demo data past the
        # 30-day task horizon.
        existing.starts_at = starts_at
        existing.ends_at = ends_at
        existing.status = AppointmentStatus.BOOKED
        logger.info(
            "appointment title=%r patient_id=%s already present — window refreshed",
            template.title,
            patient_id,
        )
        return existing

    appointment = Appointment(
        patient_id=patient_id,
        title=template.title,
        kind=template.kind,
        starts_at=starts_at,
        ends_at=ends_at,
        modality=template.modality,
        location_text=template.location_text,
        status=AppointmentStatus.BOOKED,
        participants=[
            AppointmentParticipant(
                tenant_id=tenant_id,
                user_id=caregiver_id,
                role=AppointmentParticipantRole.LEAD,
            )
        ],
    )
    session.add(appointment)
    await session.flush()
    logger.info(
        "seeded appointment title=%r patient_id=%s starts_at=%s",
        template.title,
        patient_id,
        starts_at.isoformat(),
    )
    return appointment


async def _seed(session: AsyncSession) -> None:
    await seed_appointments(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
