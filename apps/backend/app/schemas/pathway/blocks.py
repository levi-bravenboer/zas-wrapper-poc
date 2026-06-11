"""Pydantic IO contracts for the pathway block-type registry endpoint.

This module is the **schemas** layer source-of-truth for the small cross-layer
Literal types (`BlockSemanticsLiteral`, `BlockSourceLiteral`, `NestedRenderLiteral`).
Schemas is the most primitive layer everyone may import from; the domain
layer (`app.domain.pathway.blocks._base`) re-imports `BlockSourceLiteral`
and `NestedRenderLiteral` from here for its dataclass field types.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


BlockSemanticsLiteral = Literal[
    "start",
    "appointment",
    "task",
    "message",
    "form",
    "decision",
    "milestone",
    "wait",
    "pathway_link",
    "external_program",
    "end_pathway",
]

# Single-source-of-truth for the native / external / internal provenance
# literal. `internal` covers blocks whose target lives inside our own
# product (today only `pathway_link`); it sits alongside `native` (built-in
# primitives like task / message) and `external` (vendor-contributed blocks
# like `luscii.program`).
BlockSourceLiteral = Literal["native", "external", "internal"]

NestedRenderLiteral = Literal["inline_preview", "collapsed_card"]


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
    nested_render: NestedRenderLiteral | None = Field(
        default=None,
        description=(
            "UI hint for blocks whose body renders nested content (today: "
            "`pathway_link`). `inline_preview` expands a read-only summary of "
            "the linked content inside the parent canvas; `collapsed_card` "
            "renders as a single card requiring drill-down to view content. "
            "Null for blocks without nested content."
        ),
    )


__all__ = [
    "BlockSemanticsLiteral",
    "BlockSourceLiteral",
    "NestedRenderLiteral",
    "PathwayBlockType",
]
