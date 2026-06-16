"""JSON-safe coercion for audit `changes` / `context` payloads.

The jsonb columns must hold only JSON-native values. Diff values come straight
off ORM attributes (UUID, datetime, Decimal, Enum, ...) so they are coerced
before storage.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID


def json_safe(value: Any) -> Any:
    """Recursively coerce a value into JSON-native primitives."""

    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Mapping):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        return [json_safe(v) for v in value]
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return [json_safe(v) for v in value]
    return str(value)
