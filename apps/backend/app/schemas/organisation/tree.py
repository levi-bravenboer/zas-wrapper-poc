from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganisationTreeMove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    parent_organisation_id: UUID | None
    sort_index: int = Field(ge=0)


class OrganisationTreeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Cap matches the service-layer FOR UPDATE batch ceiling — bigger
    # payloads risk lock contention on common-ancestor rows. Also blocks
    # accidental empty submissions from the editor.
    moves: list[OrganisationTreeMove] = Field(min_length=1, max_length=500)
