"""Pydantic IO contract for the pathway phase-template registry endpoint."""

from __future__ import annotations

from pydantic import BaseModel


class PathwayPhaseTemplate(BaseModel):
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None


__all__ = ["PathwayPhaseTemplate"]
