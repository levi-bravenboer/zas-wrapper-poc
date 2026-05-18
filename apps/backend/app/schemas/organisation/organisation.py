from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganisationType(BaseModel):
    """FHIR-style CodeableConcept binding for Organisation.type[0].coding[0]."""

    model_config = ConfigDict(extra="forbid")

    system: str | None = None
    code: str = Field(min_length=1, max_length=64)
    display: str | None = None


class OrganisationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_organisation_id: UUID | None
    name: str
    type_code: str
    type_system: str | None
    type_display: str | None
    sort_index: int


class OrganisationListResponse(BaseModel):
    items: list[OrganisationRead]


class OrganisationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    type: OrganisationType
    parent_organisation_id: UUID | None = None


class OrganisationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: OrganisationType | None = None
