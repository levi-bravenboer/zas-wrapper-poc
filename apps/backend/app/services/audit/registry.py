"""Audited-resource registry.

`emit()` validates an explicit `resource_type` against the set of known ORM
model class names — typo protection, so a misspelled `resource_type` cannot
silently produce an un-queryable trail. This is intentionally broader than the
auto-diff opt-in (`__audited__`): a domain event may target a resource that is
not auto-audited (e.g. `Pathway` on `published`).
"""

from __future__ import annotations

from functools import lru_cache

from app.db.base import Base


@lru_cache(maxsize=1)
def known_resource_types() -> frozenset[str]:
    """Class names of every mapped ORM model.

    Cached: every model is registered at import, before any `emit()`, so the
    set is stable for the process lifetime.
    """

    return frozenset(mapper.class_.__name__ for mapper in Base.registry.mappers)


def is_known_resource(resource_type: str) -> bool:
    return resource_type in known_resource_types()
