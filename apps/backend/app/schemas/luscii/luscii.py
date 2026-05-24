"""Picker-grade summary of a Luscii program.

Returned by ``GET /luscii/programs`` so the pathway-builder inspector can
populate its program picker without loading the full `LusciiProgramData`
payload for every option. Resolved selection then fetches the full payload
via ``GET /luscii/programs/{id}``.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LusciiProgramSummary(BaseModel):
    """Lightweight program row for the inspector picker."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    version: str = Field(min_length=1)
    description: str | None = Field(default=None)
    enrolled_count_org_wide: int = Field(ge=0, default=0)
