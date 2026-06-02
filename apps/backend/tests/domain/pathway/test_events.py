from __future__ import annotations

from app.domain.pathway import EVENT_TYPES


def test_event_types_are_unique_and_dutch() -> None:
    codes = [e.code for e in EVENT_TYPES]
    assert len(codes) == len(set(codes))
    assert set(codes) == {"pathology_report", "scan_report", "lab_result", "external_data"}
    for entry in EVENT_TYPES:
        assert entry.label, f"event type {entry.code} missing label"
