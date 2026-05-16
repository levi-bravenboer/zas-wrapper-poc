from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.practitioner_role.practitioner_role import PractitionerRoleRead


class PractitionerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    family_name: str
    given_name: str
    qualification: str | None = None
    roles: list[PractitionerRoleRead] = []


class PractitionerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    family_name: str
    given_name: str
    qualification: str | None = None


class PractitionerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    family_name: str | None = None
    given_name: str | None = None
    qualification: str | None = None
