from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.care_team import RoleInCare


class ParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    role_in_care: RoleInCare
    period_start: datetime
    period_end: datetime | None = None
    acting_as_practitioner_role_id: UUID | None = None
    assigned_by: UUID
    unassigned_by: UUID | None = None


class ParticipantCreate(BaseModel):
    """`POST /care-teams/{id}/participants` payload.

    Opens a new participant row. The service enforces the partial unique
    constraint (`uq_care_team_participants_open_membership`) by checking
    for an existing open row before insert. `acting_as_practitioner_role_id`
    is optional (NULL permitted per `practitioner-role-split`).
    """

    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    role_in_care: RoleInCare
    acting_as_practitioner_role_id: UUID | None = None


class ParticipantRoleChange(BaseModel):
    """`PATCH /care-teams/{id}/participants/{user_id}` payload.

    Role changes are append-only: the service closes the current open
    row (sets `period_end`, `unassigned_by`) and inserts a new open row
    with the new role in the same transaction.
    """

    model_config = ConfigDict(extra="forbid")

    role_in_care: RoleInCare
