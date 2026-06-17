from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.audit import ActorType, AuditAction, AuditResult, PurposeOfUse
from app.services.audit.context import FieldChange


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    actor_type: ActorType
    actor_id: UUID | None
    actor_label: str | None
    tenant_id: UUID | None
    action: AuditAction
    result: AuditResult
    event_code: str | None
    resource_type: str | None
    resource_id: UUID | None
    request_id: UUID | None
    patient_id: UUID | None
    purpose_of_use: PurposeOfUse | None
    changes: dict[str, FieldChange] | None
    context: dict[str, Any] | None
