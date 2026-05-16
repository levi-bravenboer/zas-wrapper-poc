from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PathwayBlockType(BaseModel):
    type: str = Field(description="Stable kebab-case identifier")
    label: str
    default_lane_kind_code: str = Field(
        description="Stable lane-kind code (D10): patient | caregiver | system | external"
    )
    config_schema: dict[str, Any]
    supports_branches: bool = False


class PathwayPhaseTemplate(BaseModel):
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None
