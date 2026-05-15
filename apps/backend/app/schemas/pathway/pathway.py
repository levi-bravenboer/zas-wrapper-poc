from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PathwayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class PathwaySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    updated_at: datetime
    block_count: int


# Aggregate child shapes — client supplies stable UUIDs so cross-child
# references (block → phase / lane, edge → block, etc.) wire in one payload.
# `Out` variants are returned as-is from `GET /pathways/{id}`; `In` variants
# are accepted on `PUT /pathways/{id}`.


_FIXED: Literal["fixed"] = "fixed"
_ENROLLMENT: Literal["enrollment"] = "enrollment"


class PathwayTimingValueIn(BaseModel):
    id: UUID
    kind: Literal["fixed", "enrollment"]
    fixed_days: int | None = Field(default=None, ge=0)
    enrollment_default_days: int | None = Field(default=None, ge=0)
    enrollment_min_days: int | None = Field(default=None, ge=0)
    enrollment_max_days: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_kind_columns(self) -> PathwayTimingValueIn:
        if self.kind == _FIXED:
            if self.fixed_days is None:
                raise ValueError("timing kind 'fixed' requires fixed_days")
            if (
                self.enrollment_default_days is not None
                or self.enrollment_min_days is not None
                or self.enrollment_max_days is not None
            ):
                raise ValueError(
                    "timing kind 'fixed' must not set enrollment_* columns"
                )
        elif self.kind == _ENROLLMENT:
            if self.enrollment_default_days is None:
                raise ValueError(
                    "timing kind 'enrollment' requires enrollment_default_days"
                )
            if self.fixed_days is not None:
                raise ValueError("timing kind 'enrollment' must not set fixed_days")
            if (
                self.enrollment_min_days is not None
                and self.enrollment_max_days is not None
                and self.enrollment_min_days > self.enrollment_max_days
            ):
                raise ValueError("enrollment_min_days must be <= enrollment_max_days")
        return self


class PathwayTimingValueOut(PathwayTimingValueIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayPhaseIn(BaseModel):
    id: UUID
    template_id: str | None = Field(default=None, max_length=63)
    label: str = Field(min_length=1, max_length=255)
    ord: int = Field(ge=0)


class PathwayPhaseOut(PathwayPhaseIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayLaneIn(BaseModel):
    id: UUID
    lane_kind_code: str = Field(
        min_length=1,
        max_length=63,
        description="System lane-kind code (resolves to pathway_lane_kind.id server-side)",
    )
    label: str = Field(min_length=1, max_length=255)
    ord: int = Field(ge=0)
    is_default: bool = False


class PathwayLaneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pathway_lane_kind_id: UUID
    lane_kind_code: str
    label: str
    ord: int
    is_default: bool


class PathwayBlockIn(BaseModel):
    id: UUID
    phase_id: UUID
    lane_id: UUID | None = Field(
        default=None,
        description=(
            "Optional. When omitted the backend materializes the block type's "
            "default lane (see catalogue.default_lane_kind_code)."
        ),
    )
    type: str = Field(min_length=1, max_length=63)
    label: str | None = Field(default=None, max_length=255)
    duration_value_id: UUID | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    x: int = 0
    y: int = 0


class PathwayBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phase_id: UUID
    lane_id: UUID
    type: str
    label: str | None = None
    duration_value_id: UUID | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    x: int = 0
    y: int = 0


class PathwayBranchIn(BaseModel):
    id: UUID
    block_id: UUID
    label: str = Field(min_length=1, max_length=255)
    ord: int = Field(ge=0)


class PathwayBranchOut(PathwayBranchIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayEdgeIn(BaseModel):
    id: UUID
    source_block_id: UUID
    target_block_id: UUID
    source_branch_id: UUID | None = None
    delay_value_id: UUID | None = None


class PathwayEdgeOut(PathwayEdgeIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayTimeMarkerIn(BaseModel):
    id: UUID
    value_id: UUID
    label: str = Field(min_length=1, max_length=255)


class PathwayTimeMarkerOut(PathwayTimeMarkerIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayFieldResolutionIn(BaseModel):
    id: UUID
    block_id: UUID
    field_path: str = Field(min_length=1, max_length=255)


class PathwayFieldResolutionOut(PathwayFieldResolutionIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayDefinition(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    updated_at: datetime
    phases: list[PathwayPhaseOut] = Field(default_factory=list)
    lanes: list[PathwayLaneOut] = Field(default_factory=list)
    timing_values: list[PathwayTimingValueOut] = Field(default_factory=list)
    blocks: list[PathwayBlockOut] = Field(default_factory=list)
    branches: list[PathwayBranchOut] = Field(default_factory=list)
    edges: list[PathwayEdgeOut] = Field(default_factory=list)
    time_markers: list[PathwayTimeMarkerOut] = Field(default_factory=list)
    field_resolutions: list[PathwayFieldResolutionOut] = Field(default_factory=list)


class PathwayDefinitionReplace(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phases: list[PathwayPhaseIn] = Field(default_factory=list)
    lanes: list[PathwayLaneIn] = Field(default_factory=list)
    timing_values: list[PathwayTimingValueIn] = Field(default_factory=list)
    blocks: list[PathwayBlockIn] = Field(default_factory=list)
    branches: list[PathwayBranchIn] = Field(default_factory=list)
    edges: list[PathwayEdgeIn] = Field(default_factory=list)
    time_markers: list[PathwayTimeMarkerIn] = Field(default_factory=list)
    field_resolutions: list[PathwayFieldResolutionIn] = Field(default_factory=list)
