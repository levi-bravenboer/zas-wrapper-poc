"""Pydantic IO contracts for the pathway edge registry endpoints.

Two registries share this module because they're consumed by the same
edge-timing UI: timing kinds (`PathwayEdgeTimingKind`) and the offset
direction enum (`PathwayEdgeOffsetDirection`).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class PathwayEdgeTimingKind(BaseModel):
    kind: Literal["completion", "marker", "immediate", "branch"]
    label: str
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any]


class PathwayEdgeOffsetDirection(BaseModel):
    code: str
    label: str
    ord: int


__all__ = [
    "PathwayEdgeOffsetDirection",
    "PathwayEdgeTimingKind",
]
