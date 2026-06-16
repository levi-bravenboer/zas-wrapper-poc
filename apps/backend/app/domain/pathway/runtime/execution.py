"""`BlockExecution` typed domain model + state machine.

Allowed transitions:

| From       | To           | Trigger                                      |
|------------|--------------|----------------------------------------------|
| `pending`  | `eligible`   | engine: `input_logic` satisfied              |
| `pending`  | `skipped`    | admin override or upstream `decision_output` |
| `eligible` | `active`     | engine: `start(execution_id)`                |
| `eligible` | `skipped`    | upstream `decision_output` selected another  |
| `active`   | `completed`  | engine: `complete(execution_id, result)`     |
| `active`   | `failed`     | engine: caught exception during work         |

Anything else is rejected by `transition`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


BlockExecutionState = Literal[
    "pending",
    "eligible",
    "active",
    "completed",
    "skipped",
    "failed",
]


_ALLOWED_TRANSITIONS: dict[BlockExecutionState, frozenset[BlockExecutionState]] = {
    "pending": frozenset({"eligible", "skipped"}),
    "eligible": frozenset({"active", "skipped"}),
    "active": frozenset({"completed", "failed"}),
    "completed": frozenset(),
    "skipped": frozenset(),
    "failed": frozenset(),
}


class InvalidTransitionError(ValueError):
    """Rejected `BlockExecution` state transition."""

    def __init__(self, current: BlockExecutionState, target: BlockExecutionState) -> None:
        super().__init__(f"cannot transition BlockExecution {current!r} → {target!r}")
        self.current = current
        self.target = target


class BlockExecution(BaseModel):
    """Runtime cursor for one (enrollment, block_template) pair."""

    model_config = ConfigDict(extra="forbid", frozen=False)

    id: UUID
    enrollment_id: UUID
    block_template_id: UUID
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    due_at: datetime | None = None
    state: BlockExecutionState = "pending"
    result_json: dict[str, Any] | None = None
    decision_output: str | None = None

    def transition(self, target: BlockExecutionState) -> None:
        """Mutate `state` to `target` if the transition is allowed."""
        if target not in _ALLOWED_TRANSITIONS.get(self.state, frozenset()):
            raise InvalidTransitionError(self.state, target)
        self.state = target

    def is_terminal(self) -> bool:
        return self.state in {"completed", "skipped", "failed"}


__all__ = [
    "BlockExecution",
    "BlockExecutionState",
    "InvalidTransitionError",
]
