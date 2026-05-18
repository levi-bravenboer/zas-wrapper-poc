"""Catalogue invariants for the pathway block-type and edge-timing registries.

The catalogue is code-owned. These tests guard the structural promises the
frontend relies on (semantics enum, icon string, ui_schema referential
integrity) and the closed enums (event types, timing kinds, lane kinds).
"""

from __future__ import annotations

import pytest

from app.services.pathway.catalogue import (
    BLOCK_TYPES,
    EDGE_TIMING_KINDS,
    EVENT_TYPES,
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
    BlockSemantics,
)


_EXPECTED_BLOCK_TYPES: frozenset[str] = frozenset(
    {
        "appointment",
        "task",
        "message",
        "form",
        "decision",
        "milestone",
        "wait",
        "pathway_link",
    }
)

_VALID_LANE_KINDS: frozenset[str] = frozenset(
    {LANE_KIND_PATIENT, LANE_KIND_CAREGIVER, LANE_KIND_SYSTEM, LANE_KIND_EXTERNAL}
)


def test_block_roster_matches_expected_set() -> None:
    assert {b.type for b in BLOCK_TYPES} == _EXPECTED_BLOCK_TYPES


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_block_entry_has_known_semantics(entry) -> None:
    assert isinstance(entry.semantics, BlockSemantics)


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_block_entry_icon_non_empty(entry) -> None:
    assert isinstance(entry.icon, str) and entry.icon


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_block_entry_lanes_known(entry) -> None:
    assert entry.allowed_lane_kind_codes, f"{entry.type} declares no allowed lanes"
    for code in entry.allowed_lane_kind_codes:
        assert code in _VALID_LANE_KINDS, f"{entry.type} declares unknown lane kind {code!r}"


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_block_entry_ui_schema_order_references_declared_props(entry) -> None:
    order = entry.ui_schema.get("order")
    if not order:
        return
    declared = set(entry.config_schema.get("properties", {}).keys())
    extras = set(order) - declared
    assert not extras, f"{entry.type}: ui_schema.order references undeclared {extras}"


def test_event_types_are_unique_and_dutch() -> None:
    codes = [e.code for e in EVENT_TYPES]
    assert len(codes) == len(set(codes))
    assert set(codes) == {"pathology_report", "scan_report", "lab_result", "external_data"}
    for entry in EVENT_TYPES:
        assert entry.label, f"event type {entry.code} missing label"


def test_wait_block_event_type_enum_matches_event_types() -> None:
    wait = next(b for b in BLOCK_TYPES if b.type == "wait")
    declared = wait.config_schema["properties"]["event_type"]["enum"]
    assert set(declared) == {e.code for e in EVENT_TYPES}


def test_edge_timing_kinds_present() -> None:
    kinds = {k.kind for k in EDGE_TIMING_KINDS}
    assert kinds == {"completion", "marker", "immediate", "branch"}


@pytest.mark.parametrize("kind", EDGE_TIMING_KINDS, ids=lambda k: k.kind)
def test_edge_timing_config_schema_is_object(kind) -> None:
    assert kind.config_schema["type"] == "object"


def test_marker_timing_requires_full_triple() -> None:
    marker = next(k for k in EDGE_TIMING_KINDS if k.kind == "marker")
    assert set(marker.config_schema["required"]) == {
        "time_marker_id",
        "offset_value_id",
        "offset_direction_code",
    }


def test_immediate_timing_has_no_required_fields() -> None:
    immediate = next(k for k in EDGE_TIMING_KINDS if k.kind == "immediate")
    assert "required" not in immediate.config_schema
