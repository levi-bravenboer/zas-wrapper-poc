"""`DeferredFieldValue` typed domain model.

Carries the runtime value for one `DeferredFieldSpec` declaration on
one `(enrollment, block_template)` pair. Validation against the
spec's `kind` happens at the service layer where the spec table is
in scope.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DeferredFieldValue(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=False)

    id: UUID
    enrollment_id: UUID
    block_template_id: UUID
    attr: str
    value_json: Any
    set_at: datetime
    set_by_user_id: UUID | None = None


__all__ = ["DeferredFieldValue"]
