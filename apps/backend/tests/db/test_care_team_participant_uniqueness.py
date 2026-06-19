from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.care_team import RoleInCare
from app.core.enums.patient import Gender, PatientSource
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from app.db.models.user import User
from tests.db.conftest import seed_admin_user


async def _bootstrap(
    session: AsyncSession,
) -> tuple[Tenant, User, Patient, CareTeam]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor = await seed_admin_user(session, tenant_id=tenant.id)
    org = Organisation(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    patient = Patient(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        primary_organisation_id=org.id,
        given_name="P",
        family_name="P",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    session.add(patient)
    await session.flush()
    team = CareTeam(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        patient_id=patient.id,
        name="T",
    )
    session.add(team)
    await session.flush()
    return tenant, actor, patient, team


async def test_two_concurrent_open_rows_rejected(db_session: AsyncSession) -> None:
    tenant, actor, _patient, team = await _bootstrap(db_session)
    db_session.add(
        CareTeamParticipant(
            tenant_id=tenant.id,
            care_team_id=team.id,
            user_id=actor.id,
            role_in_care=RoleInCare.PRIMARY,
            assigned_by=actor.id,
        )
    )
    db_session.add(
        CareTeamParticipant(
            tenant_id=tenant.id,
            care_team_id=team.id,
            user_id=actor.id,
            role_in_care=RoleInCare.CONSULTING,
            assigned_by=actor.id,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_reopen_after_close_is_allowed(db_session: AsyncSession) -> None:
    tenant, actor, _patient, team = await _bootstrap(db_session)
    closed_at = datetime.now(UTC) - timedelta(days=1)
    db_session.add(
        CareTeamParticipant(
            tenant_id=tenant.id,
            care_team_id=team.id,
            user_id=actor.id,
            role_in_care=RoleInCare.PRIMARY,
            assigned_by=actor.id,
            period_end=closed_at,
            unassigned_by=actor.id,
        )
    )
    db_session.add(
        CareTeamParticipant(
            tenant_id=tenant.id,
            care_team_id=team.id,
            user_id=actor.id,
            role_in_care=RoleInCare.CONSULTING,
            assigned_by=actor.id,
        )
    )
    await db_session.flush()  # no IntegrityError
