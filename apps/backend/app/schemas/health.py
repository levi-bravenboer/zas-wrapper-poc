from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

CheckStatus = Literal["ok", "fail"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    started_at: datetime


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: dict[str, CheckStatus]


class RootResponse(BaseModel):
    name: str
    version: str
