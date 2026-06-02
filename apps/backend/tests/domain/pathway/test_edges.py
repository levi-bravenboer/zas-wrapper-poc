from __future__ import annotations

import pytest

from app.domain.pathway import EDGE_TIMING_KINDS, SEEDED_OFFSET_DIRECTIONS


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


def test_seeded_offset_directions_are_closed_two_value_enum() -> None:
    codes = [code for code, _label, _ord in SEEDED_OFFSET_DIRECTIONS]
    assert codes == ["before", "after"]
    for _code, label, ord_ in SEEDED_OFFSET_DIRECTIONS:
        assert label
        assert isinstance(ord_, int)
