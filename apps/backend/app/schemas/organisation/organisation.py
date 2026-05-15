from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrganisationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_organisation_id: UUID | None
    name: str
    type_code: str
    type_system: str | None
    type_display: str | None


class OrganisationListResponse(BaseModel):
    items: list[OrganisationRead]
