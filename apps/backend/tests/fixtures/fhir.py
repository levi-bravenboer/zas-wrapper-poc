"""Synthetic FHIR-shaped factories for tests.

§12.14 swaps these for `fhir.resources` types. Until then, the placeholder
Pydantic models in `app.schemas.fhir` keep the fixture signatures stable so
no test code has to change when the upgrade lands.

All names are obviously fake — never put real-looking MRNs, NHS numbers, etc.
"""

from __future__ import annotations

from datetime import date

from app.schemas.fhir import Encounter, Gender, Observation, Patient


def make_patient(
    *,
    id: str = "test-patient-1",
    name: str = "Demo Patient",
    birthdate: date | None = date(1980, 1, 1),
    gender: Gender | None = "unknown",
) -> Patient:
    return Patient(id=id, name=name, birthdate=birthdate, gender=gender)


def make_observation(
    *,
    id: str = "test-observation-1",
    subject_reference: str = "Patient/test-patient-1",
    code: str = "8867-4",
    value: float | None = 72.0,
) -> Observation:
    return Observation(id=id, subject_reference=subject_reference, code=code, value=value)


def make_encounter(
    *,
    id: str = "test-encounter-1",
    subject_reference: str = "Patient/test-patient-1",
    status: str = "planned",
) -> Encounter:
    return Encounter(id=id, subject_reference=subject_reference, status=status)  # type: ignore[arg-type]
