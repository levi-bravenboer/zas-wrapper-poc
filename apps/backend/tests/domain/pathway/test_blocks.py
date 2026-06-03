"""Pathway block-type registry invariants.

The registry is code-owned. These tests guard the structural promises the
frontend relies on (semantics enum, icon string, ui_schema referential
integrity) and the closed enums (lane kinds, source provenance).
"""

from __future__ import annotations

import jsonschema
import jsonschema.protocols
import jsonschema.validators
import pytest

from app.adapters.luscii import (
    LUSCII_PROGRAM_BLOCK_TYPE,
    LUSCII_PROGRAM_KIND,
    LUSCII_PROVIDER,
)
from app.domain.pathway import (
    BLOCK_TYPES,
    EVENT_TYPES,
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
    BlockSemantics,
    get_block_type,
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
        LUSCII_PROGRAM_BLOCK_TYPE,
    }
)

_EXPECTED_SOURCES: frozenset[str] = frozenset({"native", "external", "internal"})

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


# ---- Provenance metadata (source / provider / kind) ----------------------


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_block_entry_source_is_known(entry) -> None:
    assert entry.source in _EXPECTED_SOURCES


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_native_entries_have_null_provider_and_kind(entry) -> None:
    if entry.source != "native":
        return
    assert entry.provider is None, f"{entry.type}: native entry must not declare a provider"
    assert entry.kind is None, f"{entry.type}: native entry must not declare a kind"


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_external_entries_have_provider_and_kind(entry) -> None:
    if entry.source != "external":
        return
    assert entry.provider, f"{entry.type}: external entry must declare a provider"
    assert entry.kind, f"{entry.type}: external entry must declare a kind"


@pytest.mark.parametrize("entry", BLOCK_TYPES, ids=lambda e: e.type)
def test_external_entry_type_code_matches_provider_kind(entry) -> None:
    """Dotted type code must equal `<provider>.<kind>` so `BlockTypeCode.parse`
    and the catalogue lookup stay in lockstep."""
    if entry.source != "external":
        return
    assert entry.type == f"{entry.provider}.{entry.kind}", (
        f"{entry.type}: dotted code must equal '{entry.provider}.{entry.kind}'"
    )


def test_native_bare_codes_contain_no_dot() -> None:
    for entry in BLOCK_TYPES:
        if entry.source == "native":
            assert "." not in entry.type, f"{entry.type}: native codes must be bare (no dot)"


# ---- Luscii Program specifics --------------------------------------------


def test_luscii_program_entry_present_with_expected_provenance() -> None:
    luscii = next(b for b in BLOCK_TYPES if b.type == LUSCII_PROGRAM_BLOCK_TYPE)
    assert luscii.source == "external"
    assert luscii.provider == LUSCII_PROVIDER
    assert luscii.kind == LUSCII_PROGRAM_KIND
    assert luscii.semantics == BlockSemantics.EXTERNAL_PROGRAM
    assert luscii.icon == "activity"
    assert luscii.allowed_lane_kind_codes == (LANE_KIND_EXTERNAL,)
    assert luscii.supports_branches is False


def test_luscii_program_config_schema_is_author_time_only() -> None:
    """The block carries the three author-time keys and nothing else. No
    `required` constraint — autosave persists in-progress drafts (program
    picked but no protocol yet); publish-time validation re-asserts
    completeness."""
    luscii = next(b for b in BLOCK_TYPES if b.type == LUSCII_PROGRAM_BLOCK_TYPE)
    props = luscii.config_schema["properties"]
    assert set(props.keys()) == {"program_id", "protocol_id", "mode"}
    assert "required" not in luscii.config_schema
    assert props["mode"]["enum"] == ["blocking", "fire_and_forget"]


def test_luscii_program_config_schema_excludes_per_patient_fields() -> None:
    """Hard guard against accidentally exposing patient-level config at design
    time. Per-patient values belong to the enrollment surface, not block config.
    """
    luscii = next(b for b in BLOCK_TYPES if b.type == LUSCII_PROGRAM_BLOCK_TYPE)
    forbidden_prefixes = ("patient_", "target_", "dose")
    forbidden_suffix = "_per_patient"
    for prop in luscii.config_schema["properties"]:
        for prefix in forbidden_prefixes:
            assert not prop.startswith(prefix), (
                f"luscii.program config_schema must not declare per-patient field {prop!r}"
            )
        assert not prop.endswith(forbidden_suffix), (
            f"luscii.program config_schema must not declare per-patient field {prop!r}"
        )


def test_get_block_type_resolves_luscii_program() -> None:
    """Dotted code resolves via the same lookup path as bare codes —
    `BlockTypeCode` parsing and `BLOCK_TYPES` registry stay in lockstep."""
    entry = get_block_type(LUSCII_PROGRAM_BLOCK_TYPE)
    assert entry is not None
    assert entry.type == LUSCII_PROGRAM_BLOCK_TYPE
    assert entry.source == "external"


def _luscii_validator() -> jsonschema.protocols.Validator:
    """Build a Draft 2020-12 validator from the luscii.program config_schema."""
    luscii = next(b for b in BLOCK_TYPES if b.type == LUSCII_PROGRAM_BLOCK_TYPE)
    cls = jsonschema.validators.validator_for(luscii.config_schema)
    cls.check_schema(luscii.config_schema)
    return cls(luscii.config_schema)


def test_luscii_program_config_validates_well_formed_payload() -> None:
    validator = _luscii_validator()
    payload = {
        "program_id": "luscii-hartfalen-monitoring-v4",
        "protocol_id": "proto-std-12w",
        "mode": "blocking",
    }
    errors = list(validator.iter_errors(payload))
    assert errors == []


def test_luscii_program_config_accepts_partial_payload() -> None:
    """Author-time draft state — program picked, protocol not yet — must
    persist. Publish-time validation (Phase 5) is the gate that requires
    the full triple."""
    validator = _luscii_validator()
    payload = {"program_id": "luscii-x", "mode": "blocking"}
    errors = list(validator.iter_errors(payload))
    assert errors == []


def test_luscii_program_config_rejects_unknown_field() -> None:
    """`additionalProperties: false` keeps per-patient sneaks out of block
    config. Adding `patient_id` here would silently expose a per-patient
    field on the wrong UX surface."""
    validator = _luscii_validator()
    payload = {
        "program_id": "luscii-x",
        "protocol_id": "proto-y",
        "mode": "blocking",
        "patient_id": "smuggled-in",
    }
    errors = list(validator.iter_errors(payload))
    assert any("patient_id" in str(err.message) for err in errors), errors


def test_luscii_program_config_rejects_invalid_mode_enum() -> None:
    validator = _luscii_validator()
    payload = {
        "program_id": "luscii-x",
        "protocol_id": "proto-y",
        "mode": "yolo",
    }
    errors = list(validator.iter_errors(payload))
    assert any("yolo" in str(err.message) for err in errors), errors


def test_wait_block_event_type_enum_matches_event_types() -> None:
    wait = next(b for b in BLOCK_TYPES if b.type == "wait")
    declared = wait.config_schema["properties"]["event_type"]["enum"]
    assert set(declared) == {e.code for e in EVENT_TYPES}
