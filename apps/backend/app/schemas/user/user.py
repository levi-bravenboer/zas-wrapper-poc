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


class UserDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    external_idp: str | None
    external_subject: str | None
    created_at: datetime
    updated_at: datetime


class AssignRoleRequest(BaseModel):
    role: Role


class SetActiveRequest(BaseModel):
    is_active: bool
