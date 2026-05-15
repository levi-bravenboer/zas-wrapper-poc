# SYNTHETIC ONLY — see openspec/project.md no-PHI invariant.
#
# Seeds one active CareTeam per demo patient and assigns the demo caregiver
# as the team's `primary` participant via an open `CareTeamParticipant` row.
# This is the membership the `care-teams-base` visibility predicate keys
# off: without it, the caregiver would see zero patients post-rewrite.
#
# Idempotency:
#   - Team: lookup by `(patient_id, status='active', deleted_at IS NULL)`.
#     The PoC creates at most one active team per patient.
#   - Participant: lookup by `(care_team_id, user_id, period_end IS NULL,
#     deleted_at IS NULL)` — mirrors the partial unique index.

"""Idempotent seed of one active CareTeam + primary participant per demo patient."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.care_team import CareTeamStatus, RoleInCare
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.patient import Patient
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

logger = logging.getLogger(__name__)


class _ZasTenantMissingError(RuntimeError):
    """Raised when `seed_care_teams` runs before the `zas` tenant exists."""


class _SeedUserMissingError(RuntimeError):
    """Raised when `seed_care_teams` runs before the admin/caregiver exist."""


async def seed_care_teams(session: AsyncSession) -> list[CareTeam]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise _ZasTenantMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    user_repo = UserRepository(session)
    admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
    caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
    if admin is None or caregiver is None:
        raise _SeedUserMissingError(
            "admin/caregiver missing — run seed_users first"
        )

    patients = (
        await session.execute(
            select(Patient).where(
                Patient.tenant_id == tenant.id,
                Patient.deleted_at.is_(None),
            )
        )
    ).scalars().all()

    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )
    try:
        seeded: list[CareTeam] = []
        for patient in patients:
            team = await _get_or_create_team(session, patient=patient)
            await _get_or_create_primary_participant(
                session,
                tenant_id=tenant.id,
                team=team,
                caregiver_id=caregiver.id,
            )
            seeded.append(team)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return seeded


async def _get_or_create_team(session: AsyncSession, *, patient: Patient) -> CareTeam:
    existing = (
        await session.execute(
            select(CareTeam).where(
                CareTeam.patient_id == patient.id,
                CareTeam.status == CareTeamStatus.ACTIVE,
                CareTeam.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("care team for patient_id=%s already present", patient.id)
        return existing

    team = CareTeam(patient_id=patient.id, name="Primary care team")
    session.add(team)
    await session.flush()
    logger.info("seeded care team for patient_id=%s", patient.id)
    return team


async def _get_or_create_primary_participant(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    team: CareTeam,
    caregiver_id: UUID,
) -> CareTeamParticipant:
    existing = (
        await session.execute(
            select(CareTeamParticipant).where(
                CareTeamParticipant.care_team_id == team.id,
                CareTeamParticipant.user_id == caregiver_id,
                CareTeamParticipant.period_end.is_(None),
                CareTeamParticipant.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("open participant row already present for team_id=%s", team.id)
        return existing

    row = CareTeamParticipant(
        tenant_id=tenant_id,
        care_team_id=team.id,
        user_id=caregiver_id,
        role_in_care=RoleInCare.PRIMARY,
        assigned_by=caregiver_id,
    )
    session.add(row)
    await session.flush()
    logger.info("seeded primary participant for team_id=%s", team.id)
    return row


async def _seed(session: AsyncSession) -> None:
    await seed_care_teams(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
