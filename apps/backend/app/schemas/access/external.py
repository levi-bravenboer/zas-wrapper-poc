"""External collaboration payloads (REQ-FUN-1/42)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums.access import ConsentStatus
from app.core.enums.practitioner_role import PractitionerRoleCode


class ExternalAccessProfileUpsert(BaseModel):
    professional_type: PractitionerRoleCode
    allow_read: bool = True
    allow_write: bool = False
    allow_record: bool = False
    allow_message: bool = False


class ExternalAccessProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    professional_type: PractitionerRoleCode
    allow_read: bool
    allow_write: bool
    allow_record: bool
    allow_message: bool


class ConsentCreate(BaseModel):
    scope: str = Field(min_length=1, max_length=64, default="external_collaboration")


class ConsentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    scope: str
    status: ConsentStatus
    granted_at: datetime
    revoked_at: datetime | None


class ExternalGrantCreate(BaseModel):
    user_id: UUID
    professional_type: PractitionerRoleCode
    consent_id: UUID


class ExternalGrantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    user_id: UUID
    professional_type: PractitionerRoleCode
    consent_id: UUID
    period_start: datetime
    period_end: datetime | None
