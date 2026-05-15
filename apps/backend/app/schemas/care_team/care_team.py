from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.care_team import CareTeamStatus
from app.schemas.care_team.participant import ParticipantCreate, ParticipantRead


class CareTeamRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    name: str | None = None
    status: CareTeamStatus
    period_start: datetime
    period_end: datetime | None = None
    category: str | None = None
    participants: list[ParticipantRead] = []


class CareTeamCreate(BaseModel):
    """`POST /patients/{patient_id}/care-teams` payload.

    `participants` is part of the create payload so a team can be born
    with a primary practitioner in a single transaction. Adding or
    changing participants later goes through the participant endpoints.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    category: str | None = None
    participants: list[ParticipantCreate] = []


class CareTeamUpdate(BaseModel):
    """`PATCH /care-teams/{id}` payload — team-level metadata only.

    Participant changes are out of scope here; use the participant
    endpoints. Setting `status = inactive` or `period_end` closes the
    team but does not auto-unassign participants — the service handles
    that side-effect inside the same transaction.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    category: str | None = None
    status: CareTeamStatus | None = None
    period_end: datetime | None = None
