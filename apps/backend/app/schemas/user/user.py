from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.user import Role


class UserRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    created_at: datetime


class AssignRoleRequest(BaseModel):
    role: Role
