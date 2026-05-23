from __future__ import annotations

import pytest

from app.adapters.luscii import LUSCII_STUB_PROGRAMS_BY_ID, LusciiProgramData
from app.schemas.luscii import LusciiProgramSummary
from app.services.luscii import LusciiProgramNotFoundError, LusciiService

# Pure service-class test — no DB, no auth, no router. The Luscii service
# reads from the in-memory `LUSCII_STUB_PROGRAMS_BY_ID` constant.
pytestmark = pytest.mark.no_db


@pytest.fixture
def service() -> LusciiService:
    return LusciiService()


class TestListPrograms:
    def test_returns_summary_for_every_stub_program(self, service: LusciiService) -> None:
        rows = service.list_programs()
        assert isinstance(rows, list)
        assert {r.id for r in rows} == set(LUSCII_STUB_PROGRAMS_BY_ID)

    def test_rows_are_summary_shape(self, service: LusciiService) -> None:
        rows = service.list_programs()
        for row in rows:
            assert isinstance(row, LusciiProgramSummary)
            assert row.id and row.name and row.version
            assert row.enrolled_count_org_wide >= 0

    def test_rows_are_alphabetical_by_name(self, service: LusciiService) -> None:
        rows = service.list_programs()
        names = [r.name for r in rows]
        assert names == sorted(names)

    def test_repeated_calls_return_equal_lists(self, service: LusciiService) -> None:
        first = service.list_programs()
        second = service.list_programs()
        assert first == second


class TestGetProgram:
    def test_returns_full_payload_for_known_id(self, service: LusciiService) -> None:
        program = service.get_program("luscii-hartfalen-monitoring-v4")
        assert isinstance(program, LusciiProgramData)
        assert program.id == "luscii-hartfalen-monitoring-v4"
        assert program.name == "Hartfalen thuismonitoring"
        # Round-trip the payload to confirm full schema is intact.
        LusciiProgramData.model_validate(program.model_dump(mode="json"))

    def test_returns_distinct_payloads_per_id(self, service: LusciiService) -> None:
        ids = list(LUSCII_STUB_PROGRAMS_BY_ID)
        assert len(ids) >= 2
        a = service.get_program(ids[0])
        b = service.get_program(ids[1])
        assert a.id != b.id
        assert a.name != b.name

    def test_unknown_id_raises_not_found(self, service: LusciiService) -> None:
        with pytest.raises(LusciiProgramNotFoundError) as excinfo:
            service.get_program("does-not-exist")
        assert excinfo.value.code == "not-found.luscii.program"
        assert excinfo.value.status_code == 404
        assert excinfo.value.details == {"program_id": "does-not-exist"}

    def test_empty_string_raises_not_found(self, service: LusciiService) -> None:
        with pytest.raises(LusciiProgramNotFoundError):
            service.get_program("")
