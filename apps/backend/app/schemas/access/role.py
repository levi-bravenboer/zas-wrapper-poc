from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    is_system: bool
    permissions: list[str]
    created_at: datetime


class RoleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    name: str
    permissions: list[str] = []

    @field_validator("slug")
    @classmethod
    def _slug_shape(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("slug is required")
        return v


class RoleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    # When provided, replaces the role's full permission set.
    permissions: list[str] | None = None
