from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.audit import ActorType, AuditAction, AuditResult
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
    resource_type: str | None
    resource_id: UUID | None
    request_id: UUID | None
    changes: dict[str, FieldChange] | None
    context: dict[str, Any] | None
