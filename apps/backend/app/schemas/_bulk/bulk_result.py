from __future__ import annotations

from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# Default to UUID so the common case stays terse; generic param lets future
# resources key bulk ops by a different id type without a parallel schema.
T = TypeVar("T", default=UUID)


class BulkFailure(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    code: str
    message: str


class BulkResult(BaseModel, Generic[T]):
    model_config = ConfigDict(frozen=True)

    succeeded: list[T]
    failed: list[BulkFailure]


class BulkRequest(BaseModel, Generic[T]):
    """Bulk action body; subclass to attach per-action params alongside `ids`."""

    model_config = ConfigDict(frozen=True)

    ids: list[T]
