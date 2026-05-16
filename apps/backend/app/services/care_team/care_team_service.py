from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums.care_team import RoleInCare
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.user import User
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.care_team.care_team import CareTeamCreate, CareTeamUpdate
from app.schemas.care_team.participant import ParticipantCreate
from app.services.care_team.errors import (
    CareTeamNotFoundError,
    CrossTenantUserError,
    ParticipantAlreadyOpenError,
    ParticipantNotFoundError,
)
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
)


class CareTeamService:
    """Tenant-scoped orchestration for CareTeam + participants.

    Participants are append-only: role changes close the current open row
    (`period_end`, `unassigned_by`) and insert a new open row in the same
    transaction. The partial unique index on `(care_team_id, user_id)
    WHERE period_end IS NULL` is the source of truth — service-side checks
    fail fast with a typed 409 before the DB constraint trips.
    """

    def __init__(self, session: AsyncSession, organisation_repo: OrganisationRepository) -> None:
        self._session = session
        self._org_repo = organisation_repo

    async def list_for_patient(self, tenant_id: UUID, patient_id: UUID) -> list[CareTeam]:
        result = await self._session.execute(
            select(CareTeam)
            .where(
                CareTeam.patient_id == patient_id,
                CareTeam.tenant_id == tenant_id,
                CareTeam.deleted_at.is_(None),
            )
            .order_by(CareTeam.period_start.desc())
        )
        return list(result.scalars().unique().all())

    async def get_by_id(self, tenant_id: UUID, care_team_id: UUID) -> CareTeam | None:
        result = await self._session.execute(
            select(CareTeam)
            .where(
                CareTeam.id == care_team_id,
                CareTeam.tenant_id == tenant_id,
                CareTeam.deleted_at.is_(None),
            )
            .options(selectinload(CareTeam.participants))
        )
        return result.scalar_one_or_none()

    async def create_for_patient(
        self, actor: SessionUser, patient_id: UUID, payload: CareTeamCreate
    ) -> CareTeam:
        team = CareTeam(
            patient_id=patient_id,
            tenant_id=actor.tenant_id,
            name=payload.name,
            category=payload.category,
        )
        for p in payload.participants:
            team.participants.append(await self._build_participant(actor, p))
        self._session.add(team)
        await self._session.flush()
        # Re-fetch with `selectinload(participants)` so the response
        # serialiser does not trigger a lazy load outside the async context.
        refreshed = await self.get_by_id(actor.tenant_id, team.id)
        assert refreshed is not None  # just flushed in this transaction
        return refreshed

    async def update(
        self, actor: SessionUser, care_team_id: UUID, payload: CareTeamUpdate
    ) -> CareTeam:
        team = await self.get_by_id(actor.tenant_id, care_team_id)
        if team is None:
            raise CareTeamNotFoundError()
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(team, field, value)
        await self._session.flush()
        return team

    async def add_participant(
        self, actor: SessionUser, care_team_id: UUID, payload: ParticipantCreate
    ) -> CareTeamParticipant:
        team = await self.get_by_id(actor.tenant_id, care_team_id)
        if team is None:
            raise CareTeamNotFoundError()
        if await self._open_participant_row(care_team_id, payload.user_id) is not None:
            raise ParticipantAlreadyOpenError()
        row = await self._build_participant(actor, payload)
        row.care_team_id = care_team_id
        self._session.add(row)
        await self._session.flush()
        return row

    async def change_participant_role(
        self,
        actor: SessionUser,
        care_team_id: UUID,
        user_id: UUID,
        new_role: RoleInCare,
    ) -> CareTeamParticipant:
        team = await self.get_by_id(actor.tenant_id, care_team_id)
        if team is None:
            raise CareTeamNotFoundError()
        current = await self._open_participant_row(care_team_id, user_id)
        if current is None:
            raise ParticipantNotFoundError()
        if current.role_in_care == new_role:
            return current
        now = datetime.now(UTC)
        current.period_end = now
        current.unassigned_by = actor.id
        await self._session.flush()
        new_row = CareTeamParticipant(
            tenant_id=actor.tenant_id,
            care_team_id=care_team_id,
            user_id=user_id,
            role_in_care=new_role,
            on_behalf_of_organisation_id=current.on_behalf_of_organisation_id,
            assigned_by=actor.id,
            period_start=now,
        )
        self._session.add(new_row)
        await self._session.flush()
        return new_row

    async def unassign_participant(
        self, actor: SessionUser, care_team_id: UUID, user_id: UUID
    ) -> None:
        team = await self.get_by_id(actor.tenant_id, care_team_id)
        if team is None:
            raise CareTeamNotFoundError()
        current = await self._open_participant_row(care_team_id, user_id)
        if current is None:
            raise ParticipantNotFoundError()
        current.period_end = datetime.now(UTC)
        current.unassigned_by = actor.id
        await self._session.flush()

    async def visible_patient_ids_for(self, user: SessionUser) -> set[UUID]:
        """Patient ids the user can see via an open participant row.

        Used by `patients-base` to filter the patient list for caregivers.
        Admins bypass this — see `PatientService.list_in_tenant`.
        """

        result = await self._session.execute(
            select(CareTeam.patient_id)
            .join(CareTeamParticipant, CareTeamParticipant.care_team_id == CareTeam.id)
            .where(
                CareTeamParticipant.user_id == user.id,
                CareTeamParticipant.period_end.is_(None),
                CareTeam.tenant_id == user.tenant_id,
                CareTeam.deleted_at.is_(None),
            )
            .distinct()
        )
        return set(result.scalars().all())

    async def has_open_membership(self, user_id: UUID, patient_id: UUID) -> bool:
        result = await self._session.execute(
            select(CareTeamParticipant.id)
            .join(CareTeam, CareTeam.id == CareTeamParticipant.care_team_id)
            .where(
                CareTeamParticipant.user_id == user_id,
                CareTeamParticipant.period_end.is_(None),
                CareTeam.patient_id == patient_id,
                CareTeam.deleted_at.is_(None),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _build_participant(
        self, actor: SessionUser, payload: ParticipantCreate
    ) -> CareTeamParticipant:
        await self._assert_user_in_tenant(actor.tenant_id, payload.user_id)
        if payload.on_behalf_of_organisation_id is not None:
            await self._assert_organisation_in_tenant(
                actor.tenant_id, payload.on_behalf_of_organisation_id
            )
        return CareTeamParticipant(
            tenant_id=actor.tenant_id,
            user_id=payload.user_id,
            role_in_care=payload.role_in_care,
            on_behalf_of_organisation_id=payload.on_behalf_of_organisation_id,
            assigned_by=actor.id,
        )

    async def _open_participant_row(
        self, care_team_id: UUID, user_id: UUID
    ) -> CareTeamParticipant | None:
        result = await self._session.execute(
            select(CareTeamParticipant).where(
                CareTeamParticipant.care_team_id == care_team_id,
                CareTeamParticipant.user_id == user_id,
                CareTeamParticipant.period_end.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def _assert_user_in_tenant(self, tenant_id: UUID, user_id: UUID) -> None:
        result = await self._session.execute(
            select(User.tenant_id).where(User.id == user_id, User.deleted_at.is_(None))
        )
        row_tenant = result.scalar_one_or_none()
        if row_tenant is None or row_tenant != tenant_id:
            raise CrossTenantUserError()

    async def _assert_organisation_in_tenant(self, tenant_id: UUID, organisation_id: UUID) -> None:
        org = await self._org_repo.get_by_id(organisation_id)
        if org is None:
            raise OrganisationNotFoundError()
        if org.tenant_id != tenant_id:
            raise CrossTenantOrganisationError()
