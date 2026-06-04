"""Specialism master data + carepath scoping payloads (REQ-NON-10/12, REQ-FUN-28)."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SpecialismCreate(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    display: str = Field(min_length=1, max_length=255)


class SpecialismRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    display: str
    source: str


class SpecialismIdsUpdate(BaseModel):
    """Replace-set semantics: the full desired link set, not a diff."""

    specialism_ids: list[UUID]


class AssignedUserIdsUpdate(BaseModel):
    """Replace-set semantics. An empty list clears explicit assignment —
    the carepath falls back to specialism-wide access (REQ-NON-12)."""

    user_ids: list[UUID]
