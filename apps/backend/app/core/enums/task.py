"""Task-domain enums.

`TaskStatus` is the minimal MVP lifecycle: `open` | `done`. Completion is a
status flip, not a soft-delete. `in_progress` / priority labels are deferred
until a workflow needs them.
"""

from __future__ import annotations

from enum import StrEnum


class TaskStatus(StrEnum):
    OPEN = "open"
    DONE = "done"
