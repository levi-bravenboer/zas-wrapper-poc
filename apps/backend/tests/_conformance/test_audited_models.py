"""Conformance: the starter audit opt-in set stays audited.

Pins `User` + `Patient` (Q1) so a model cannot silently fall out of audit. Add
to `_EXPECTED` when a new model opts into `__audited__`.
"""

from __future__ import annotations

import app.db.models  # noqa: F401  (register every model)
from app.db.base import Entity

# PathwayEnrollment + PathwayBlockExecution audit their runtime transitions
# (pathway-runtime §3.7); Task/Note/Attachment from split-appointments-and-tasks;
# Appointment from fhir-aligned-audit-trail. Pathway / PathwayBlock are
# deliberately NOT auto-audited — pathway authoring is captured as explicit
# domain events (app/services/pathway/audit_events.py), so they are absent here.
_EXPECTED = {
    "User",
    "Patient",
    "PathwayEnrollment",
    "PathwayBlockExecution",
    "Task",
    "Note",
    "Attachment",
    "Appointment",
}

# Audited models whose rows do NOT concern a single patient (no patient axis).
_PATIENTLESS = {"User"}

# Patient-scoped but the patient is reached via a parent, not a direct column
# (Q1-sub): `PathwayBlockExecution` resolves its patient through the enrollment.
# Its `before_flush` auto-diffs therefore carry a null `patient_id`; the patient
# axis for these is set by the explicit `runtime.block_executed` emit instead.
_PATIENT_VIA_PARENT = {"PathwayBlockExecution"}


def _all_subclasses(cls: type) -> set[type]:
    seen: set[type] = set()
    stack = list(cls.__subclasses__())
    while stack:
        sub = stack.pop()
        if sub in seen:
            continue
        seen.add(sub)
        stack.extend(sub.__subclasses__())
    return seen


def _audited_classes() -> dict[str, type]:
    return {
        cls.__name__: cls
        for cls in _all_subclasses(Entity)
        if cls.__dict__.get("__audited__", False)
    }


def test_audited_starter_set() -> None:
    assert set(_audited_classes()) == _EXPECTED


def test_patient_scoped_models_resolve_patient_id() -> None:
    # D11: every audited model that is not explicitly patient-less must either
    # be the Patient model or carry a `patient_id` column, so `_patient_of`
    # in app/db/audit.py can populate the patient axis.
    for name, cls in _audited_classes().items():
        if name in _PATIENTLESS or name in _PATIENT_VIA_PARENT:
            continue
        resolves = name == "Patient" or "patient_id" in cls.__table__.columns
        assert resolves, f"{name} is audited and patient-scoped but cannot resolve patient_id"
