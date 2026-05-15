from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

RealtimeAction = Literal["upsert", "delete"]


class RealtimeEvent(BaseModel):
    """Single invalidation message broadcast to subscribed clients.

    Carries the resource name and (optionally) the affected row id so
    the frontend can decide to invalidate either the list query for the
    resource or a specific detail query keyed by id. `v` is the message
    envelope version; bump on any payload schema change.
    """

    model_config = ConfigDict(frozen=True)

    resource: str
    action: RealtimeAction
    id: str | None = None
    v: int = 1
