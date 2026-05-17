from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


BlockSemanticsLiteral = Literal[
    "appointment",
    "task",
    "message",
    "form",
    "decision",
    "milestone",
    "wait",
    "pathway_link",
]


class PathwayBlockType(BaseModel):
    type: str = Field(description="Stable kebab-case identifier")
    label: str
    semantics: BlockSemanticsLiteral = Field(
        description=(
            "Runtime dispatch key. Multiple types may share semantics in the "
            "future (e.g. appointment subtypes) without forcing per-type branching."
        ),
    )
    icon: str = Field(
        min_length=1,
        description="Lucide icon name. Resolved client-side via a single lookup.",
    )
    allowed_lane_kind_codes: list[str] = Field(
        min_length=1,
        description=(
            "Lane-kind codes this block type may be placed on. The first entry "
            "is the default placement when no explicit lane context exists."
        ),
    )
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Widget hints, field order, and labels for schema-driven inspector "
            "rendering. Consumed by the orchestrator's SchemaForm engine."
        ),
    )
    supports_branches: bool = False


class PathwayPhaseTemplate(BaseModel):
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None


class PathwayEventType(BaseModel):
    code: str
    label: str


class PathwayEdgeTimingKind(BaseModel):
    kind: Literal["completion", "marker", "immediate", "branch"]
    label: str
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any]


class PathwayEdgeOffsetDirection(BaseModel):
    code: str
    label: str
    ord: int
