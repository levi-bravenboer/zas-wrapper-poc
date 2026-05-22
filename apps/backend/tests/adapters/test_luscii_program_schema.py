from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.adapters.luscii.program import (
    LusciiAlertThreshold,
    LusciiInstrument,
    LusciiLayout,
    LusciiLayoutEdge,
    LusciiLayoutLane,
    LusciiLayoutNode,
    LusciiLayoutPhase,
    LusciiProgramData,
    LusciiProtocol,
)


def _sample_hartfalen() -> dict:
    """The Hartfalen reference payload from design.md, in dict form.

    Use as a known-good baseline for the Pydantic schema; mutate fields in
    individual tests to exercise validation.
    """
    return {
        "id": "luscii-hartfalen-monitoring-v4",
        "name": "Hartfalen thuismonitoring",
        "description": "Daily monitoring for chronic heart failure with weekly KCCQ.",
        "version": "v4.2",
        "version_published_at": "2026-05-08T00:00:00Z",
        "ce_class": "IIa",
        "is_two_way_messaging": True,
        "enrolled_count_org_wide": 248,
        "protocols": [
            {
                "id": "proto-std-12w",
                "name": "Standaard 12 weken",
                "duration_weeks": 12,
                "reminder_cadence": "daily 09:00",
                "overdue_hours": 48,
                "is_default": True,
            },
            {
                "id": "proto-intensief-16w",
                "name": "Intensief 16 weken",
                "duration_weeks": 16,
                "reminder_cadence": "twice daily",
                "overdue_hours": 24,
                "is_default": False,
            },
        ],
        "instruments": [
            {"code": "bp", "label": "Bloeddruk", "cadence": "1×/dag", "icon": "heart-pulse"},
            {"code": "weight", "label": "Gewicht", "cadence": "1×/dag", "icon": "scale"},
            {"code": "spo2", "label": "Saturatie", "cadence": "1×/dag", "icon": "droplets"},
            {"code": "kccq", "label": "KCCQ", "cadence": "1×/week", "icon": "clipboard-list"},
        ],
        "alert_thresholds": [
            {"label": "Syst. BP", "rule": "< 90 of > 180"},
            {"label": "Gewichtstoename", "rule": "≥ 2 kg / 48u"},
        ],
        "care_network": "Cardioloog + monitoring-verpleegkundige",
        "layout": {
            "phases": [
                {"id": "p1", "ord": 0, "label": "Onboarding"},
                {"id": "p2", "ord": 1, "label": "Pre-op"},
                {"id": "p3", "ord": 2, "label": "Monitor"},
                {"id": "p4", "ord": 3, "label": "Close-out"},
            ],
            "lanes": [
                {"id": "l1", "ord": 0, "kind": "patient"},
                {"id": "l2", "ord": 1, "kind": "caregiver"},
                {"id": "l3", "ord": 2, "kind": "external"},
                {"id": "l4", "ord": 3, "kind": "system"},
            ],
            "nodes": [
                {
                    "id": "n1",
                    "phase_id": "p1",
                    "lane_id": "l4",
                    "x": 70,
                    "y": 26,
                    "label": "Welkomstmail",
                    "type": "message",
                    "timing_label": "D0",
                    "is_entry": True,
                },
                {
                    "id": "n2",
                    "phase_id": "p2",
                    "lane_id": "l1",
                    "x": 70,
                    "y": 26,
                    "label": "Intake-vragenlijst",
                    "type": "form",
                    "timing_label": "D1",
                },
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2"},
            ],
        },
    }


class TestLusciiProgramData:
    def test_hartfalen_reference_payload_validates(self) -> None:
        data = LusciiProgramData.model_validate(_sample_hartfalen())
        assert data.id == "luscii-hartfalen-monitoring-v4"
        assert data.name == "Hartfalen thuismonitoring"
        assert data.ce_class == "IIa"
        assert data.is_two_way_messaging is True
        assert len(data.protocols) == 2
        assert data.protocols[0].is_default is True
        assert len(data.instruments) == 4
        assert len(data.layout.phases) == 4
        assert len(data.layout.lanes) == 4
        assert len(data.layout.nodes) == 2
        assert data.layout.nodes[0].is_entry is True

    def test_minimal_payload_validates(self) -> None:
        """Bare-minimum payload — only required fields."""
        data = LusciiProgramData.model_validate(
            {
                "id": "luscii-minimal-v1",
                "name": "Minimal",
                "version": "v1",
                "version_published_at": "2026-01-01T00:00:00Z",
                "protocols": [
                    {
                        "id": "proto-default",
                        "name": "Default",
                        "duration_weeks": 1,
                        "reminder_cadence": "daily",
                        "overdue_hours": 24,
                    }
                ],
                "layout": {
                    "phases": [{"id": "p1", "ord": 0, "label": "Only"}],
                    "lanes": [{"id": "l1", "ord": 0, "kind": "patient"}],
                    "nodes": [],
                    "edges": [],
                },
            }
        )
        assert data.description is None
        assert data.care_network is None
        assert data.enrolled_count_org_wide == 0
        assert data.is_two_way_messaging is False
        assert data.instruments == []
        assert data.alert_thresholds == []

    def test_protocols_required_non_empty(self) -> None:
        payload = _sample_hartfalen()
        payload["protocols"] = []
        with pytest.raises(ValidationError):
            LusciiProgramData.model_validate(payload)

    def test_unknown_lane_kind_rejected(self) -> None:
        payload = _sample_hartfalen()
        payload["layout"]["lanes"][0]["kind"] = "manager"  # not in enum
        with pytest.raises(ValidationError):
            LusciiProgramData.model_validate(payload)

    def test_unknown_node_type_rejected(self) -> None:
        payload = _sample_hartfalen()
        payload["layout"]["nodes"][0]["type"] = "wizard"  # not in enum
        with pytest.raises(ValidationError):
            LusciiProgramData.model_validate(payload)

    def test_negative_node_coords_rejected(self) -> None:
        payload = _sample_hartfalen()
        payload["layout"]["nodes"][0]["x"] = -5
        with pytest.raises(ValidationError):
            LusciiProgramData.model_validate(payload)

    def test_zero_duration_protocol_rejected(self) -> None:
        payload = _sample_hartfalen()
        payload["protocols"][0]["duration_weeks"] = 0
        with pytest.raises(ValidationError):
            LusciiProgramData.model_validate(payload)

    def test_frozen_models(self) -> None:
        """The payload is immutable once parsed — guards against accidental
        mutation of cached registry entries."""
        data = LusciiProgramData.model_validate(_sample_hartfalen())
        with pytest.raises(ValidationError):
            data.model_copy(update={"id": "other"}).protocols[0].name = "Changed"  # type: ignore[misc]


class TestLayoutChildren:
    def test_phase_requires_label_and_ord(self) -> None:
        LusciiLayoutPhase(id="p1", ord=0, label="Onboarding")
        with pytest.raises(ValidationError):
            LusciiLayoutPhase(id="p1", ord=-1, label="X")  # type: ignore[arg-type]
        with pytest.raises(ValidationError):
            LusciiLayoutPhase(id="p1", ord=0, label="")  # empty label

    def test_lane_requires_kind(self) -> None:
        LusciiLayoutLane(id="l1", ord=0, kind="patient")
        with pytest.raises(ValidationError):
            LusciiLayoutLane(id="l1", ord=0, kind="unknown")  # type: ignore[arg-type]

    def test_edge_minimal(self) -> None:
        edge = LusciiLayoutEdge(id="e1", source="n1", target="n2")
        assert edge.source == "n1"

    def test_node_requires_phase_and_lane(self) -> None:
        node = LusciiLayoutNode(
            id="n1",
            phase_id="p1",
            lane_id="l1",
            x=70,
            y=26,
            label="Welkomstmail",
            type="message",
        )
        assert node.is_entry is False
        assert node.timing_label is None


class TestProtocolDefault:
    def test_default_is_optional(self) -> None:
        p = LusciiProtocol(
            id="p1",
            name="Standaard",
            duration_weeks=12,
            reminder_cadence="daily 09:00",
            overdue_hours=48,
        )
        assert p.is_default is False


class TestInstrumentAndThreshold:
    def test_instrument_requires_icon(self) -> None:
        LusciiInstrument(code="bp", label="Bloeddruk", cadence="1×/dag", icon="heart-pulse")
        with pytest.raises(ValidationError):
            LusciiInstrument(code="bp", label="Bloeddruk", cadence="1×/dag", icon="")

    def test_threshold_requires_label_and_rule(self) -> None:
        LusciiAlertThreshold(label="Syst. BP", rule="< 90 of > 180")
        with pytest.raises(ValidationError):
            LusciiAlertThreshold(label="", rule="< 90")
        with pytest.raises(ValidationError):
            LusciiAlertThreshold(label="Syst. BP", rule="")


def test_version_published_at_accepts_iso_z() -> None:
    payload = _sample_hartfalen()
    data = LusciiProgramData.model_validate(payload)
    assert data.version_published_at == datetime(2026, 5, 8, tzinfo=timezone.utc)
