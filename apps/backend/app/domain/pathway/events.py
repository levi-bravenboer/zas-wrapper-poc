"""Event-kind registry referenced by the `wait` block.

Closed enum of external events a `wait` block may listen for. Promotion to
a tenant-extensible lookup table is deferred (see design D3).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EventTypeEntry:
    code: str
    label: str


EVENT_TYPES: tuple[EventTypeEntry, ...] = (
    EventTypeEntry(code="pathology_report", label="Pathologie verslag"),
    EventTypeEntry(code="scan_report", label="Radiologie verslag"),
    EventTypeEntry(code="lab_result", label="Lab uitslag"),
    EventTypeEntry(code="external_data", label="Externe data"),
)


_EVENT_TYPE_CODES: tuple[str, ...] = tuple(e.code for e in EVENT_TYPES)


def get_event_type_codes() -> tuple[str, ...]:
    return _EVENT_TYPE_CODES


__all__ = [
    "EVENT_TYPES",
    "EventTypeEntry",
    "get_event_type_codes",
]
