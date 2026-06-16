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


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1)
