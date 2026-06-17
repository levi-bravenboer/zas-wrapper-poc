from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums.collaboration import OwnerType


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_type: OwnerType
    owner_id: UUID
    patient_id: UUID | None
    author_user_id: UUID
    author_display_name: str
    body: str
    created_at: datetime
    # Where the note lives (appointment title / task title / pathway-step name).
    # Resolved only in the patient aggregate so the patient view shows each
    # note's source; null for patient-owned notes and per-owner lists.
    owner_label: str | None = None


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1)
