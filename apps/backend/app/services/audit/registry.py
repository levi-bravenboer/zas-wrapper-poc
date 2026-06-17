"""Audited-resource registry.

`emit()` validates an explicit `resource_type` against the set of known ORM
model class names — typo protection, so a misspelled `resource_type` cannot
silently produce an un-queryable trail. This is intentionally broader than the
auto-diff opt-in (`__audited__`): a domain event may target a resource that is
not auto-audited (e.g. `Pathway` on `published`).
"""

from __future__ import annotations

from app.db.base import Base


def known_resource_types() -> frozenset[str]:
    """Class names of every mapped ORM model.

    Recomputed per call (not cached) so a model registered after the first
    call is still recognised — `emit()` runs infrequently, so the cost is
    negligible and the import-ordering risk of caching is avoided.
    """

    return frozenset(mapper.class_.__name__ for mapper in Base.registry.mappers)


def is_known_resource(resource_type: str) -> bool:
    return resource_type in known_resource_types()


# FHIR `AuditEvent.code` — the most-specific domain event, namespaced by surface.
# Validated at emit so a misspelled code cannot produce an un-queryable trail.
# Grows per feature; add the code here when a new emit site lands.
KNOWN_EVENT_CODES: frozenset[str] = frozenset(
    {
        "pathway.published",
        "runtime.enrolled",
        "runtime.block_executed",
        "runtime.sla_escalated",
        "runtime.decision_branched",
        "runtime.deferred_value_resolved",
        "runtime.fast_forwarded",
        "patient.dossier_viewed",
        "auth.login",
        "auth.logout",
    }
)


def is_known_event_code(event_code: str) -> bool:
    return event_code in KNOWN_EVENT_CODES
