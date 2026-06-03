"""Pydantic IO contract for the pathway event-type registry endpoint."""

from __future__ import annotations

from pydantic import BaseModel


class PathwayEventType(BaseModel):
    code: str
    label: str


__all__ = ["PathwayEventType"]
