from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.practitioner import PractitionerRole
from app.schemas.auth.auth import SessionUser
from app.schemas.practitioner_role.practitioner_role import (
    PractitionerRoleCreate,
    PractitionerRoleUpdate,
)
from app.services.organisation.organisation_service import OrganisationService
from app.services.practitioner.practitioner_service import PractitionerService
from app.services.practitioner_role.errors import (
    ClosedRolePromotionError,
    CrossTenantPractitionerRoleError,
    DuplicateOpenAffiliationError,
    PractitionerRoleNotFoundError,
)


class PractitionerRoleService:
    """Tenant-scoped lifecycle for `PractitionerRole` rows.

    Open-row attributes (`code`, `specialty`, `is_primary`) accept in-place
    PATCH; the `period` is append-only — closing a role stamps `period_end`
    and clears `is_primary` via `close_role`, and reopening is unsupported
    (open a fresh row instead). The partial unique indexes
    `uq_practitioner_roles_open_affiliation` and
    `uq_practitioner_roles_open_primary` are the source of truth; the
    service-side guards fail fast with typed errors before the index
    constraint trips.
    """

    def __init__(
        self,
        session: AsyncSession,
        practitioner_service: PractitionerService,
        organisation_service: OrganisationService,
    ) -> None:
        self._session = session
        self._practitioner_service = practitioner_service
        self._organisation_service = organisation_service

    async def list_for_tenant(
        self,
        actor: SessionUser,
        *,
        practitioner_id: UUID | None = None,
        organisation_id: UUID | None = None,
        is_open: bool | None = None,
    ) -> list[PractitionerRole]:
        stmt = select(PractitionerRole).where(
            PractitionerRole.tenant_id == actor.tenant_id,
            PractitionerRole.deleted_at.is_(None),
        )
        if practitioner_id is not None:
            stmt = stmt.where(PractitionerRole.practitioner_id == practitioner_id)
        if organisation_id is not None:
            stmt = stmt.where(PractitionerRole.organisation_id == organisation_id)
        if is_open is True:
            stmt = stmt.where(PractitionerRole.period_end.is_(None))
        elif is_open is False:
            stmt = stmt.where(PractitionerRole.period_end.is_not(None))
        stmt = stmt.order_by(
            PractitionerRole.is_primary.desc(),
            PractitionerRole.period_start.desc(),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def open_role(
        self, actor: SessionUser, payload: PractitionerRoleCreate
    ) -> PractitionerRole:
        await self._practitioner_service.assert_in_tenant(
            actor.tenant_id, payload.practitioner_id
        )
        await self._organisation_service.assert_in_tenant(
            actor.tenant_id, payload.organisation_id
        )
        if await self._has_open_at(payload.practitioner_id, payload.organisation_id):
            raise DuplicateOpenAffiliationError()
        if payload.is_primary:
            await self._demote_open_primary(payload.practitioner_id)
        row = PractitionerRole(
            tenant_id=actor.tenant_id,
            practitioner_id=payload.practitioner_id,
            organisation_id=payload.organisation_id,
            code=payload.code,
            specialty=payload.specialty,
            is_primary=payload.is_primary,
            period_start=payload.period_start or datetime.now(UTC),
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def update(
        self, actor: SessionUser, role_id: UUID, payload: PractitionerRoleUpdate
    ) -> PractitionerRole:
        row = await self._get_owned(actor, role_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("is_primary") is True:
            if row.period_end is not None:
                raise ClosedRolePromotionError()
            await self._demote_open_primary(row.practitioner_id, exclude_id=row.id)
        for field, value in data.items():
            setattr(row, field, value)
        await self._session.flush()
        return row

    async def close_role(self, actor: SessionUser, role_id: UUID) -> PractitionerRole:
        row = await self._get_owned(actor, role_id)
        if row.period_end is None:
            row.period_end = datetime.now(UTC)
            row.is_primary = False
            await self._session.flush()
        return row

    async def _get_owned(self, actor: SessionUser, role_id: UUID) -> PractitionerRole:
        result = await self._session.execute(
            select(PractitionerRole).where(
                PractitionerRole.id == role_id,
                PractitionerRole.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise PractitionerRoleNotFoundError()
        if row.tenant_id != actor.tenant_id:
            raise CrossTenantPractitionerRoleError()
        return row

    async def _has_open_at(self, practitioner_id: UUID, organisation_id: UUID) -> bool:
        result = await self._session.execute(
            select(PractitionerRole.id).where(
                PractitionerRole.practitioner_id == practitioner_id,
                PractitionerRole.organisation_id == organisation_id,
                PractitionerRole.period_end.is_(None),
            )
        )
        return result.scalar_one_or_none() is not None

    async def _demote_open_primary(
        self, practitioner_id: UUID, *, exclude_id: UUID | None = None
    ) -> None:
        stmt = select(PractitionerRole).where(
            PractitionerRole.practitioner_id == practitioner_id,
            PractitionerRole.is_primary.is_(True),
            PractitionerRole.period_end.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(PractitionerRole.id != exclude_id)
        result = await self._session.execute(stmt)
        for row in result.scalars().all():
            row.is_primary = False
        await self._session.flush()

