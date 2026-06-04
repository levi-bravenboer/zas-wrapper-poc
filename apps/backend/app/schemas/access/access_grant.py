"""Break-glass grant payloads (REQ-NON-8)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AccessGrantCreate(BaseModel):
    # reason is mandatory and persisted verbatim — validation rejects
    # whitespace-only strings; the duration cap is enforced in the service
    # against `authz_break_glass_max_hours`.
    reason: str = Field(min_length=1)
    hours: int = Field(ge=1)


class AccessGrantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    user_id: UUID
    reason: str
    granted_by: UUID = Field(validation_alias="created_by")
    granted_at: datetime = Field(validation_alias="created_at")
    expires_at: datetime
    revoked_at: datetime | None
