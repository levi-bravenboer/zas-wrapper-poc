from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import StrEnum

from app.services.audit.serialize import json_safe


class _Color(StrEnum):
    RED = "red"


def test_primitives_pass_through() -> None:
    assert json_safe("x") == "x"
    assert json_safe(3) == 3
    assert json_safe(True) is True
    assert json_safe(None) is None


def test_uuid_datetime_decimal_enum() -> None:
    u = uuid.uuid4()
    assert json_safe(u) == str(u)
    assert json_safe(datetime(2026, 1, 2, 3, 4, tzinfo=timezone.utc)).startswith("2026-01-02")
    assert json_safe(date(2026, 1, 2)) == "2026-01-02"
    assert json_safe(Decimal("1.50")) == "1.50"
    assert json_safe(_Color.RED) == "red"


def test_nested_and_json_round_trip() -> None:
    value = {"id": uuid.uuid4(), "tags": {"a", "b"}, "nums": (1, 2)}
    safe = json_safe(value)
    assert isinstance(safe["id"], str)
    assert sorted(safe["tags"]) == ["a", "b"]
    assert safe["nums"] == [1, 2]
    json.dumps(safe)  # must not raise
