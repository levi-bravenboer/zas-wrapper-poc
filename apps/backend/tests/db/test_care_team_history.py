from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.care_team import RoleInCare
from app.core.enums.patient import Gender, PatientSource
from app.core.enums.user import Role
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.schemas.auth.auth import SessionUser
from app.services.care_team.care_team_service import CareTeamService


async def _setup(session: AsyncSession) -> tuple[SessionUser, CareTeam]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor_id = uuid.uuid4()
    actor = User(
        id=actor_id,
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        email="a@example.test",
        password_hash="hash",
        display_name="a",
        role=Role.ADMIN,
        is_active=True,
    )
    session.add(actor)
    await session.flush()
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
    session.add(
        CareTeamParticipant(
            tenant_id=tenant.id,
            care_team_id=team.id,
            user_id=actor.id,
            role_in_care=RoleInCare.PRIMARY,
            assigned_by=actor.id,
        )
    )
    await session.flush()
    return (
        SessionUser(
            id=actor.id,
            email=actor.email,
            display_name=actor.display_name,
            tenant_id=tenant.id,
            role=actor.role,
        ),
        team,
    )


async def test_change_role_produces_two_rows(db_session: AsyncSession) -> None:
    session_user, team = await _setup(db_session)
    service = CareTeamService(db_session, OrganisationRepository(db_session))
    await service.change_participant_role(
        session_user, team.id, session_user.id, RoleInCare.CONSULTING
    )
    rows = (
        (
            await db_session.execute(
                select(CareTeamParticipant)
                .where(
                    CareTeamParticipant.care_team_id == team.id,
                    CareTeamParticipant.user_id == session_user.id,
                )
                .order_by(CareTeamParticipant.period_start)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    assert rows[0].role_in_care == RoleInCare.PRIMARY
    assert rows[0].period_end is not None
    assert rows[0].unassigned_by == session_user.id
    assert rows[1].role_in_care == RoleInCare.CONSULTING
    assert rows[1].period_end is None
    assert rows[1].period_start >= rows[0].period_end
