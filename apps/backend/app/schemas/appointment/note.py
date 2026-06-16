from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AppointmentNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author_user_id: UUID
    author_display_name: str
    body: str
    created_at: datetime


class AppointmentNoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1)
