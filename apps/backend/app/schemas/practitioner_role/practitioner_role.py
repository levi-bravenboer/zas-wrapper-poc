from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.practitioner_role import PractitionerRoleCode


class PractitionerRoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    practitioner_id: UUID
    organisation_id: UUID
    code: PractitionerRoleCode
    specialty: str | None = None
    is_primary: bool
    period_start: datetime
    period_end: datetime | None = None


class PractitionerRoleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    practitioner_id: UUID
    organisation_id: UUID
    code: PractitionerRoleCode
    specialty: str | None = None
    is_primary: bool = False
    period_start: datetime | None = None


class PractitionerRoleUpdate(BaseModel):
    """PATCH payload for an open role.

    `period_end` is intentionally NOT settable here — closing a role goes
    through `DELETE /practitioner-roles/{id}` so the close-side invariants
    (drop primary, stamp `period_end=now`) run in one place. Reopening a
    closed role is not supported; open a fresh row instead.
    """

    model_config = ConfigDict(extra="forbid")

    code: PractitionerRoleCode | None = None
    specialty: str | None = None
    is_primary: bool | None = None
