"""FHIR-aligned audit enum values (fhir-aligned-audit-trail §1)."""

from __future__ import annotations

from app.core.enums.audit import ActorType, AuditAction, PurposeOfUse


def test_action_is_fhir_crude_plus_legacy_login() -> None:
    assert {a.value for a in AuditAction} == {
        "created",
        "read",
        "updated",
        "deleted",
        "execute",
        "login",
    }


def test_actor_type_includes_patient() -> None:
    assert ActorType.PATIENT.value == "patient"
    assert {a.value for a in ActorType} == {"user", "patient", "system", "anonymous"}


def test_purpose_of_use_values() -> None:
    assert {p.value for p in PurposeOfUse} == {
        "treatment",
        "operations",
        "patient_request",
        "emergency",
        "break_the_glass",
    }


def test_enum_round_trip() -> None:
    assert AuditAction("read") is AuditAction.READ
    assert AuditAction("execute") is AuditAction.EXECUTE
    assert ActorType("patient") is ActorType.PATIENT
    assert PurposeOfUse("break_the_glass") is PurposeOfUse.BREAK_THE_GLASS
