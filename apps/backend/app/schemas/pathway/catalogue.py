from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PathwayLaneKindRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    label: str


class PathwayBlockType(BaseModel):
    type: str = Field(description="Stable kebab-case identifier")
    label: str
    default_lane_kind_id: UUID
    config_schema: dict[str, Any]
    supports_branches: bool = False


class PathwayPhaseTemplate(BaseModel):
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None
