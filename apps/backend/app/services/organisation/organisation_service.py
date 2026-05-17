from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.organisation import Organisation
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.organisation.organisation import OrganisationCreate, OrganisationUpdate
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationInUseError,
    OrganisationNotFoundError,
)


class OrganisationService:
    def __init__(self, session: AsyncSession, repo: OrganisationRepository) -> None:
        self._session = session
        self._repo = repo

    async def list_in_tenant(self, tenant_id: UUID) -> list[Organisation]:
        return await self._repo.list_in_tenant(tenant_id)

    async def assert_in_tenant(self, tenant_id: UUID, organisation_id: UUID) -> None:
        org = await self._repo.get_by_id(organisation_id)
        if org is None:
            raise OrganisationNotFoundError()
        if org.tenant_id != tenant_id:
            raise CrossTenantOrganisationError()

    async def assert_same_tenant_parent(self, tenant_id: UUID, parent_id: UUID | None) -> None:
        if parent_id is None:
            return
        await self.assert_in_tenant(tenant_id, parent_id)

    async def get_root_ancestor_id(self, organisation_id: UUID) -> UUID | None:
        root = await self._repo.get_root_ancestor(organisation_id)
        return root.id if root is not None else None

    async def create(self, actor: SessionUser, payload: OrganisationCreate) -> Organisation:
        if payload.parent_organisation_id is not None:
            await self.assert_same_tenant_parent(actor.tenant_id, payload.parent_organisation_id)

        org = Organisation(
            tenant_id=actor.tenant_id,
            parent_organisation_id=payload.parent_organisation_id,
            name=payload.name.strip(),
            type_code=payload.type.code,
            type_system=payload.type.system,
            type_display=payload.type.display,
        )
        self._session.add(org)
        await self._session.flush()
        return org

    async def update(
        self, actor: SessionUser, organisation_id: UUID, payload: OrganisationUpdate
    ) -> Organisation:
        org = await self._repo.get_by_id(organisation_id)
        if org is None:
            raise OrganisationNotFoundError()
        if org.tenant_id != actor.tenant_id:
            raise CrossTenantOrganisationError()
        if payload.name is not None:
            org.name = payload.name.strip()
        if payload.type is not None:
            org.type_code = payload.type.code
            org.type_system = payload.type.system
            org.type_display = payload.type.display
        await self._session.flush()
        return org

    async def soft_delete(self, actor: SessionUser, organisation_id: UUID) -> None:
        org = await self._repo.get_by_id(organisation_id)
        if org is None:
            raise OrganisationNotFoundError()
        if org.tenant_id != actor.tenant_id:
            raise CrossTenantOrganisationError()

        references: list[str] = []
        if await self._repo.count_child_organisations(organisation_id) > 0:
            references.append("organisations")
        if await self._repo.count_patients_with_primary(organisation_id) > 0:
            references.append("patients")
        if await self._repo.count_open_practitioner_roles(organisation_id) > 0:
            references.append("practitioner_roles")

        if references:
            raise OrganisationInUseError(details={"references": references})

        await self._repo.soft_delete(org)
