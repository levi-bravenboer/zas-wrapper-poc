# SYNTHETIC ONLY — see openspec/project.md no-PHI invariant.
#
# Seeds a few demo tasks assigned to the demo caregiver so the Taken inbox is
# not empty in the demo. Tasks are a real domain now (not an appointment
# projection); creation goes through the same actor-stamped session the other
# seeds use. Idempotent: keyed on (assignee, title).

"""Idempotent seed of demo tasks for the demo caregiver under the `zas` tenant."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.access.rbac.resolver import build_session_user
from app.core.enums.appointment import AppointmentStatus
from app.core.enums.task import TaskStatus
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.appointment import Appointment
from app.db.models.task import Task
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Template:
    title: str
    description: str | None
    due_in: timedelta | None
    status: TaskStatus


_TEMPLATES: tuple[_Template, ...] = (
    _Template(
        "Bel patiënt voor opvolging bloeddruk",
        "Controleer of de waarden stabiel zijn.",
        timedelta(days=1),
        TaskStatus.OPEN,
    ),
    _Template("Verwijsbrief huisarts nakijken", None, timedelta(days=3), TaskStatus.OPEN),
    _Template("Labresultaten valideren", "Ontstekingswaarden bevestigen.", None, TaskStatus.OPEN),
    _Template("Revalidatieplan afgerond", None, timedelta(days=-2), TaskStatus.DONE),
)


class _SeedUserMissingError(RuntimeError):
    """Raised when seed_tasks runs before the admin/caregiver exist."""


async def seed_tasks(session: AsyncSession) -> list[Task]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise _SeedUserMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")
    user_repo = UserRepository(session)
    admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
    caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
    if admin is None or caregiver is None:
        raise _SeedUserMissingError("admin/caregiver missing — run seed_users first")

    # Demo tasks are patient-care tasks: link them to a caregiver-accessible
    # patient (the first booked appointment's subject) so notes/attachments —
    # which are always about a patient — can be added against them.
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
    demo_patient_id = appointment.patient_id if appointment is not None else None

    now = datetime.now(UTC)
    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = await build_session_user(session, admin)
    try:
        seeded: list[Task] = []
        for tpl in _TEMPLATES:
            existing = (
                await session.execute(
                    select(Task).where(
                        Task.tenant_id == tenant.id,
                        Task.assignee_user_id == caregiver.id,
                        Task.title == tpl.title,
                        Task.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                if existing.patient_id is None and demo_patient_id is not None:
                    existing.patient_id = demo_patient_id
                    logger.info("backfilled patient on task %r", tpl.title)
                else:
                    logger.info("task %r already present", tpl.title)
                seeded.append(existing)
                continue
            task = Task(
                assignee_user_id=caregiver.id,
                title=tpl.title,
                description=tpl.description,
                status=tpl.status,
                due_at=now + tpl.due_in if tpl.due_in is not None else None,
                patient_id=demo_patient_id,
            )
            session.add(task)
            await session.flush()
            logger.info("seeded task %r", tpl.title)
            seeded.append(task)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return seeded


async def _seed(session: AsyncSession) -> None:
    await seed_tasks(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
