from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Operator = Literal["eq", "in", "gte", "lte", "contains", "not"]

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


class ListQuery(BaseModel):
    model_config = ConfigDict(frozen=True)

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
    q: str | None = None
    order_by: str | None = None
    order: Literal["asc", "desc"] = "asc"
    filters: dict[str, dict[Operator, list[str]]] = Field(default_factory=dict)

    @field_validator("q", mode="before")
    @classmethod
    def _normalise_q(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value
