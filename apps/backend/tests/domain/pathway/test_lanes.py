from __future__ import annotations

from app.domain.pathway import (
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
    SEEDED_LANE_KINDS,
)


def test_lane_kind_codes_are_unique_and_lowercase() -> None:
    codes = [LANE_KIND_PATIENT, LANE_KIND_CAREGIVER, LANE_KIND_SYSTEM, LANE_KIND_EXTERNAL]
    assert len(set(codes)) == len(codes)
    for code in codes:
        assert code.islower()
        assert " " not in code


def test_seeded_lane_kinds_match_constants() -> None:
    codes = {code for code, _label in SEEDED_LANE_KINDS}
    assert codes == {
        LANE_KIND_PATIENT,
        LANE_KIND_CAREGIVER,
        LANE_KIND_SYSTEM,
        LANE_KIND_EXTERNAL,
    }


def test_seeded_lane_kinds_have_labels() -> None:
    for _code, label in SEEDED_LANE_KINDS:
        assert label
        assert isinstance(label, str)


def test_seeded_lane_kinds_first_entry_is_patient() -> None:
    """First seed becomes the default placement when no lane context exists;
    `patient` is the canonical default per the catalogue authoring rules."""
    assert SEEDED_LANE_KINDS[0][0] == LANE_KIND_PATIENT
