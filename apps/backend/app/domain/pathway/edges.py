"""Edge-related registries.

Two things live here:

- `EDGE_TIMING_KINDS` — the four timing kinds an edge may use
  (`completion`, `marker`, `immediate`, `branch`). Each entry exposes a
  JSON Schema describing which `pathway_edge` columns its kind expects;
  the service layer enforces the cross-kind invariant.
- `SEEDED_OFFSET_DIRECTIONS` — code-owned seed for the
  `pathway_edge_offset_direction` FK target table; only the `marker`
  timing kind reads from this enum.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.domain.pathway._helpers import object_schema


@dataclass(frozen=True, slots=True)
class EdgeTimingKindEntry:
    kind: str
    label: str
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any]


EDGE_TIMING_KINDS: tuple[EdgeTimingKindEntry, ...] = (
    EdgeTimingKindEntry(
        kind="completion",
        label="Na voltooiing",
        config_schema=object_schema(
            properties={
                "delay_value_id": {"type": "string", "format": "uuid"},
            },
            required=["delay_value_id"],
        ),
        ui_schema={"order": ["delay_value_id"]},
    ),
    EdgeTimingKindEntry(
        kind="marker",
        label="Rond marker",
        config_schema=object_schema(
            properties={
                "time_marker_id": {"type": "string", "format": "uuid"},
                "offset_value_id": {"type": "string", "format": "uuid"},
                "offset_direction_code": {"type": "string", "enum": ["before", "after"]},
            },
            required=["time_marker_id", "offset_value_id", "offset_direction_code"],
        ),
        ui_schema={
            "order": ["time_marker_id", "offset_direction_code", "offset_value_id"],
            "widgets": {"offset_direction_code": "offset-direction-picker"},
        },
    ),
    EdgeTimingKindEntry(
        kind="immediate",
        label="Direct",
        config_schema=object_schema(properties={}),
        ui_schema={"order": []},
    ),
    EdgeTimingKindEntry(
        kind="branch",
        label="Vanaf tak",
        config_schema=object_schema(
            properties={
                "source_branch_id": {"type": "string", "format": "uuid"},
            },
            required=["source_branch_id"],
        ),
        ui_schema={"order": ["source_branch_id"]},
    ),
)


# (code, label, ord). Code-owned source of truth; the DB table
# `pathway_edge_offset_direction` is seeded from this and exists only so FK
# integrity can be enforced on `pathway_edge.offset_direction_code`. Only the
# `marker` timing kind references this enum.
SEEDED_OFFSET_DIRECTIONS: tuple[tuple[str, str, int], ...] = (
    ("before", "Voor", 10),
    ("after", "Na", 20),
)


__all__ = [
    "EDGE_TIMING_KINDS",
    "EdgeTimingKindEntry",
    "SEEDED_OFFSET_DIRECTIONS",
]
