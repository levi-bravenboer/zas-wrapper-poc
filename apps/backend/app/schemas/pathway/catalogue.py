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
    "external_program",
]

# Single-source-of-truth for the native-vs-external provenance literal.
# Lives in the schemas layer (safe to import from services per layer
# rules); the services-layer code-side catalogue + the block-type-code
# parser re-export this as `BlockSource` for terser local names.
BlockSourceLiteral = Literal["native", "external"]


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
    source: BlockSourceLiteral = Field(
        default="native",
        description=(
            "Provenance of this catalogue entry. Native blocks live in our own "
            "code-side `BLOCK_TYPES` registry; external blocks are contributed "
            "by per-vendor catalogue extensions (Luscii first). The frontend "
            "palette groups by `source` then by `provider`."
        ),
    )
    provider: str | None = Field(
        default=None,
        description=(
            "Vendor identifier for external blocks (e.g. `luscii`). Null for "
            "native blocks. Combined with `kind`, identifies which per-provider "
            "React component renders the block on canvas / in the inspector."
        ),
    )
    kind: str | None = Field(
        default=None,
        description=(
            "Vendor-specific block kind for external blocks (e.g. `program`). "
            "Null for native blocks."
        ),
    )


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
