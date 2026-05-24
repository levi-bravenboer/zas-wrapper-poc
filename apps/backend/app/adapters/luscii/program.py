"""Pydantic schema for a Luscii care-pathway program.

This is the contract that flows from the `luscii_program` table all the way
to the orchestrator thumbnail renderer. Stored as a single `JSONB data`
column in the table (see `external-block-integrations` design.md), exposed
via the `resolve_block` adapter method, regenerated as a TypeScript
component in `apps/orchestrator/src/lib/api/schema.d.ts` after
`/openapi-sync`.

Layout coordinate model mirrors `PathwayBlock` — each node carries
`phase_id` + `lane_id` (cell coords) + `x` + `y` (intra-cell pixel offsets
in Luscii's own coordinate space). The orchestrator's mini-canvas renderer
reuses `blockOrigin`-style math scaled to its viewBox.

POC stub-mode synthetic only — no real Luscii ids, no real patient data.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Layout — phases × lanes × nodes × edges. Drives the thumbnail.
# ---------------------------------------------------------------------------

LusciiLaneKind = Literal["patient", "caregiver", "external", "system"]
"""Subset of our pathway lane kinds that a Luscii program can target. The
External lane is the *outer* host for the Luscii block itself; the lane
kinds *inside* the program's layout may include patient / caregiver / system
because that's how Luscii itself describes the journey."""


class LusciiLayoutPhase(BaseModel):
    """A horizontal phase column inside the program's mini-canvas."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1)
    ord: int = Field(ge=0)
    label: str = Field(min_length=1)


class LusciiLayoutLane(BaseModel):
    """A horizontal lane row inside the program's mini-canvas."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1)
    ord: int = Field(ge=0)
    kind: LusciiLaneKind


LusciiNodeType = Literal[
    "appointment",
    "task",
    "message",
    "form",
    "questionnaire",
    "measurement",
    "decision",
    "milestone",
    "education",
]
"""Coarse node-type taxonomy. Drives the thumbnail's glyph + color. Mirrors
our native block semantics where they overlap; `questionnaire` /
`measurement` / `education` are Luscii-shaped categories that don't map
1:1 to a native semantics."""


class LusciiLayoutNode(BaseModel):
    """A node inside the program's mini-canvas. Coordinate model mirrors
    `PathwayBlock`: cell = (phase_id, lane_id), intra-cell = (x, y)."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1)
    phase_id: str = Field(min_length=1)
    lane_id: str = Field(min_length=1)
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    label: str = Field(min_length=1)
    type: LusciiNodeType
    timing_label: str | None = Field(
        default=None,
        description="Short human label like 'D0' / 'W1-12 · 1×/dag'. Shown next to the node in the large block rendering.",
    )
    is_entry: bool = Field(default=False)


class LusciiLayoutEdge(BaseModel):
    """A directed connector between two layout nodes."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)


class LusciiLayout(BaseModel):
    model_config = ConfigDict(frozen=True)

    phases: list[LusciiLayoutPhase] = Field(min_length=1)
    lanes: list[LusciiLayoutLane] = Field(min_length=1)
    nodes: list[LusciiLayoutNode] = Field(default_factory=list)
    edges: list[LusciiLayoutEdge] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Per-program detail — protocols, instruments, alerts, care network.
# Surfaced in the inspector's read-only Program contents card.
# ---------------------------------------------------------------------------


class LusciiProtocol(BaseModel):
    """A Luscii protocol — variant of a program with its own cadence."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    duration_weeks: int = Field(gt=0)
    reminder_cadence: str = Field(min_length=1)
    overdue_hours: int = Field(ge=0)
    is_default: bool = Field(default=False)


class LusciiInstrument(BaseModel):
    """A measurement / questionnaire instrument inside the program."""

    model_config = ConfigDict(frozen=True)

    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    cadence: str = Field(min_length=1)
    icon: str = Field(min_length=1, description="Lucide icon name (kebab-case)")


class LusciiAlertThreshold(BaseModel):
    """A clinician-facing alert threshold defined by Luscii. Read-only here."""

    model_config = ConfigDict(frozen=True)

    label: str = Field(min_length=1)
    rule: str = Field(min_length=1)


# ---------------------------------------------------------------------------
# Top-level program payload — what `luscii_program.data` carries.
# ---------------------------------------------------------------------------


class LusciiProgramData(BaseModel):
    """Full Luscii program payload, stored as JSONB in `luscii_program.data`.

    Stub-mode rows are seeded from this shape; future live-mode rows are
    upserted with the same shape. The orchestrator consumes it via the
    `resolve_block` adapter method and regenerated TypeScript types.
    """

    model_config = ConfigDict(frozen=True)

    id: str = Field(
        min_length=1,
        description="Luscii's program id. Mirrors the `luscii_program.id` PK and `pathway_block.config.program_id`.",
    )
    name: str = Field(min_length=1)
    description: str | None = Field(default=None)
    version: str = Field(min_length=1)
    version_published_at: datetime
    ce_class: Literal["IIa"] = Field(
        default="IIa",
        description="Luscii Vitals' MDR Class. Stays IIa across all Luscii programs we'd surface.",
    )
    is_two_way_messaging: bool = Field(default=False)
    enrolled_count_org_wide: int = Field(ge=0, default=0)

    protocols: list[LusciiProtocol] = Field(min_length=1)
    instruments: list[LusciiInstrument] = Field(default_factory=list)
    alert_thresholds: list[LusciiAlertThreshold] = Field(default_factory=list)
    care_network: str | None = Field(default=None)
    layout: LusciiLayout
