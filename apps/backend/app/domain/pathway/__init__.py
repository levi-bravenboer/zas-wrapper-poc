"""Pathway domain — type system + registries.

Public re-exports forming the stable import surface for the rest of the
backend. Internal moves inside `app.domain.pathway.*` should never require
edits outside this layer; consumers import from here.
"""

from __future__ import annotations

from app.domain.pathway.blocks import BLOCK_CATALOGUE, get_catalogue_entry
from app.domain.pathway.blocks.block_type_code import (
    BLOCK_TYPE_CODE_PATTERN,
    BlockTypeCode,
    InvalidBlockTypeCodeError,
)
from app.domain.pathway.edges import (
    EDGE_TIMING_KINDS,
    SEEDED_OFFSET_DIRECTIONS,
    EdgeTimingKindEntry,
)
from app.domain.pathway.events import EVENT_TYPES, EventTypeEntry
from app.domain.pathway.lanes import (
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
    SEEDED_LANE_KINDS,
)
from app.domain.pathway.phases import (
    PHASE_TEMPLATES,
    PhaseTemplateEntry,
    get_phase_template,
)


__all__ = [
    "BLOCK_CATALOGUE",
    "BLOCK_TYPE_CODE_PATTERN",
    "BlockTypeCode",
    "EDGE_TIMING_KINDS",
    "EVENT_TYPES",
    "EdgeTimingKindEntry",
    "EventTypeEntry",
    "InvalidBlockTypeCodeError",
    "LANE_KIND_CAREGIVER",
    "LANE_KIND_EXTERNAL",
    "LANE_KIND_PATIENT",
    "LANE_KIND_SYSTEM",
    "PHASE_TEMPLATES",
    "PhaseTemplateEntry",
    "SEEDED_LANE_KINDS",
    "SEEDED_OFFSET_DIRECTIONS",
    "get_catalogue_entry",
    "get_phase_template",
]
