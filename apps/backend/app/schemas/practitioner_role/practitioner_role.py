from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.enums.practitioner_role import PractitionerRoleCode


class PractitionerSummary(BaseModel):
    """Denormalised practitioner identity for list views.

    Populated by serialising a `Practitioner` ORM row whose `user`
    relationship is loaded (selectinload). The `display_name` field is
    pulled from the linked `User`; the rest are direct columns.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    display_name: str
    family_name: str
    given_name: str

    @model_validator(mode="before")
    @classmethod
    def _from_practitioner_row(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return value
        user = getattr(value, "user", None)
        if user is None:
            return value
        return {
            "id": value.id,
            "user_id": value.user_id,
            "display_name": user.display_name,
            "family_name": value.family_name,
            "given_name": value.given_name,
        }


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
    # Nested summary; populated when the `practitioner` relationship is
    # loaded (selectinload-on-read by default). `None` when serialising a
    # row that hasn't yet been refreshed with the relationship attached.
    practitioner: PractitionerSummary | None = None


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
