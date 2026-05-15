from __future__ import annotations

from uuid import UUID

from app.db.models.organisation import Organisation
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
)


class OrganisationService:
    def __init__(self, repo: OrganisationRepository) -> None:
        self._repo = repo

    async def list_in_tenant(self, tenant_id: UUID) -> list[Organisation]:
        return await self._repo.list_in_tenant(tenant_id)

    async def assert_same_tenant_parent(self, tenant_id: UUID, parent_id: UUID | None) -> None:
        if parent_id is None:
            return
        parent = await self._repo.get_by_id(parent_id)
        if parent is None:
            raise OrganisationNotFoundError()
        if parent.tenant_id != tenant_id:
            raise CrossTenantOrganisationError()

    async def get_root_ancestor_id(self, organisation_id: UUID) -> UUID | None:
        root = await self._repo.get_root_ancestor(organisation_id)
        return root.id if root is not None else None
