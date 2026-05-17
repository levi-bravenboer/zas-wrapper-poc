from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PathwayBlockType(BaseModel):
    type: str = Field(description="Stable kebab-case identifier")
    label: str
    allowed_lane_kind_codes: list[str] = Field(
        min_length=1,
        description=(
            "Lane-kind codes this block type may be placed on. The first entry "
            "is the default placement when no explicit lane context exists."
        ),
    )
    config_schema: dict[str, Any]
    supports_branches: bool = False


class PathwayPhaseTemplate(BaseModel):
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None
