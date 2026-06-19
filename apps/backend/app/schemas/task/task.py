from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.task import TaskStatus


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignee_user_id: UUID
    title: str
    description: str | None = None
    status: TaskStatus
    due_at: datetime | None = None
    patient_id: UUID | None = None
    source_ref: str | None = None
    created_at: datetime
    updated_at: datetime


class TaskStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TaskStatus
