"""Synthetic HiX fixtures. Names are obviously fake."""

from __future__ import annotations

from datetime import date

from app.schemas.fhir import Patient

_PATIENTS: dict[str, Patient] = {
    "demo-1": Patient(id="demo-1", name="Demo Patient One", birthdate=date(1980, 1, 1), gender="female"),
    "demo-2": Patient(id="demo-2", name="Demo Patient Two", birthdate=date(1975, 6, 15), gender="male"),
}


def get_patient(reference: str) -> Patient | None:
    return _PATIENTS.get(reference)
