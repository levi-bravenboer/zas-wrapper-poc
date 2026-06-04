from __future__ import annotations

from typing import Literal
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


class RoleSelectionRequiredResponse(BaseModel):
    """Login succeeded but the human holds several roles on this surface
    (REQ-NON-3). The session cookie is set and live; protected routes answer
    409 until `POST /auth/session/role` binds one of `available_roles`."""

    requires_role_selection: Literal[True] = True
    available_roles: list[Role]


class RoleSelectRequest(BaseModel):
    role: Role
