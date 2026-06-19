"""Serializable payloads crossing the Temporal workflow/activity boundary.

All fields are pydantic-friendly so the `pydantic_data_converter` (wired in
`app.temporal.client`) round-trips them without custom codecs. The acting
`SessionUser` travels with every payload so activities can stamp audit rows
(`session.info[SESSION_ACTOR_KEY]`) the same way the HTTP path does.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.schemas.auth.auth import SessionUser


class EnrollmentWorkflowInput(BaseModel):
    enrollment_id: UUID
    actor: SessionUser


class AdvanceInput(BaseModel):
    enrollment_id: UUID
    actor: SessionUser
    now: datetime


class CompleteStepInput(BaseModel):
    enrollment_id: UUID
    execution_id: UUID
    result: dict[str, Any] | None
    actor: SessionUser
    now: datetime


class CancelInput(BaseModel):
    enrollment_id: UUID
    actor: SessionUser


__all__ = [
    "AdvanceInput",
    "CancelInput",
    "CompleteStepInput",
    "EnrollmentWorkflowInput",
]
