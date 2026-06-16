"""Conformance: the starter audit opt-in set stays audited.

Pins `User` + `Patient` (Q1) so a model cannot silently fall out of audit. Add
to `_EXPECTED` when a new model opts into `__audited__`.
"""

from __future__ import annotations

import app.db.models  # noqa: F401  (register every model)
from app.db.base import Entity

_EXPECTED = {"User", "Patient", "Task", "Note", "Attachment"}


def _all_subclasses(cls: type) -> set[type]:
    seen: set[type] = set()
    stack = list(cls.__subclasses__())
    while stack:
        sub = stack.pop()
        if sub in seen:
            continue
        seen.add(sub)
        stack.extend(sub.__subclasses__())
    return seen


def test_audited_starter_set() -> None:
    audited = {
        cls.__name__ for cls in _all_subclasses(Entity) if cls.__dict__.get("__audited__", False)
    }
    assert audited == _EXPECTED
