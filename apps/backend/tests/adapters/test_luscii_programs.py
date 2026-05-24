from __future__ import annotations

import pytest

from app.adapters.luscii import (
    LUSCII_STUB_ID_PREFIX,
    LUSCII_STUB_PROGRAMS,
    LUSCII_STUB_PROGRAMS_BY_ID,
    LusciiProgramData,
)


EXPECTED_IDS = (
    "luscii-hartfalen-monitoring-v4",
    "luscii-copd-self-management-v2",
    "luscii-diabetes-coaching-v6",
    "luscii-rugrevalidatie-monitoring-v0",
)


class TestStubRegistry:
    def test_exactly_four_programs(self) -> None:
        assert len(LUSCII_STUB_PROGRAMS) == 4

    def test_expected_ids_present(self) -> None:
        actual = {p.id for p in LUSCII_STUB_PROGRAMS}
        assert actual == set(EXPECTED_IDS)

    def test_lookup_by_id_complete(self) -> None:
        for program_id in EXPECTED_IDS:
            assert program_id in LUSCII_STUB_PROGRAMS_BY_ID
            assert LUSCII_STUB_PROGRAMS_BY_ID[program_id].id == program_id

    def test_all_ids_namespaced(self) -> None:
        """Every stub id must start with `luscii-` so they are visibly
        synthetic and won't collide with anything real Luscii ever publishes."""
        for program in LUSCII_STUB_PROGRAMS:
            assert program.id.startswith(LUSCII_STUB_ID_PREFIX), program.id


class TestPayloadValidity:
    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_payload_round_trips_through_pydantic(self, program: LusciiProgramData) -> None:
        """Each seed payload must serialize → deserialize through
        LusciiProgramData without loss (catches schema-drift between the
        seed module and the Pydantic contract)."""
        dumped = program.model_dump(mode="json")
        reloaded = LusciiProgramData.model_validate(dumped)
        assert reloaded == program

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_at_least_one_protocol(self, program: LusciiProgramData) -> None:
        assert len(program.protocols) >= 1

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_exactly_one_default_protocol(self, program: LusciiProgramData) -> None:
        defaults = [p for p in program.protocols if p.is_default]
        assert len(defaults) == 1, f"{program.id}: expected 1 default protocol, got {len(defaults)}"

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_layout_phase_ords_are_consecutive_from_zero(self, program: LusciiProgramData) -> None:
        ords = sorted(p.ord for p in program.layout.phases)
        assert ords == list(range(len(ords)))

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_layout_lane_ords_are_consecutive_from_zero(self, program: LusciiProgramData) -> None:
        ords = sorted(lane.ord for lane in program.layout.lanes)
        assert ords == list(range(len(ords)))

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_layout_nodes_reference_known_phase_and_lane(self, program: LusciiProgramData) -> None:
        phase_ids = {p.id for p in program.layout.phases}
        lane_ids = {lane.id for lane in program.layout.lanes}
        for node in program.layout.nodes:
            assert node.phase_id in phase_ids, (
                f"{program.id}/{node.id}: unknown phase {node.phase_id}"
            )
            assert node.lane_id in lane_ids, f"{program.id}/{node.id}: unknown lane {node.lane_id}"

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_layout_edges_reference_known_nodes(self, program: LusciiProgramData) -> None:
        node_ids = {n.id for n in program.layout.nodes}
        for edge in program.layout.edges:
            assert edge.source in node_ids, f"{program.id}/{edge.id}: unknown source {edge.source}"
            assert edge.target in node_ids, f"{program.id}/{edge.id}: unknown target {edge.target}"

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_exactly_one_entry_node(self, program: LusciiProgramData) -> None:
        entries = [n for n in program.layout.nodes if n.is_entry]
        assert len(entries) == 1, f"{program.id}: expected 1 entry node, got {len(entries)}"

    @pytest.mark.parametrize("program", LUSCII_STUB_PROGRAMS, ids=lambda p: p.id)
    def test_at_least_one_instrument(self, program: LusciiProgramData) -> None:
        assert len(program.instruments) >= 1


class TestKnownExamples:
    def test_hartfalen_shape(self) -> None:
        program = LUSCII_STUB_PROGRAMS_BY_ID["luscii-hartfalen-monitoring-v4"]
        assert program.name == "Hartfalen thuismonitoring"
        assert program.is_two_way_messaging is True
        assert len(program.protocols) == 3
        assert len(program.instruments) == 4
        assert len(program.layout.phases) == 4
        assert len(program.layout.lanes) == 4
        assert len(program.layout.nodes) == 7

    def test_rugrevalidatie_is_pilot(self) -> None:
        program = LUSCII_STUB_PROGRAMS_BY_ID["luscii-rugrevalidatie-monitoring-v0"]
        assert "beta" in program.version
        assert program.enrolled_count_org_wide < 100  # pilot scale
