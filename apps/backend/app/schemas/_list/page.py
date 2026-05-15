from __future__ import annotations

from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Generic envelope for paginated list responses.

    `arbitrary_types_allowed` lets repositories return Pydantic-validated
    pages whose `items` are SQLAlchemy entities; routers map them to their
    response schemas before serialisation.
    """

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    items: list[T]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)

    @classmethod
    def build(cls, items: list[T], page: int, page_size: int, total: int) -> "Page[T]":
        total_pages = ceil(total / page_size) if total > 0 else 0
        return cls(
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )
