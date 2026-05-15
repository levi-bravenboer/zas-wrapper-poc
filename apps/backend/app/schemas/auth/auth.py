from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, SecretStr

from app.core.enums.user import Role


class LoginRequest(BaseModel):
    email: str
    password: SecretStr


class SessionUser(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: UUID
    email: str
    display_name: str
    tenant_id: UUID
    role: Role
