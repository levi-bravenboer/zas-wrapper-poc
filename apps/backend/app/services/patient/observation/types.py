"""Server-side allow-list of measurement types accepted by the local
observation create endpoint.

Single source of truth for `code` / `code_system` / `unit`: the client supplies
only the type key; the server resolves the canonical coding. Adding a new
supported type is a one-line data change here — no contract/UI churn.

LOINC `8867-4` = Heart rate (beats per minute).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class MeasurementType(StrEnum):
    HEART_RATE = "heart_rate"
    BLOOD_PRESSURE = "blood_pressure"


@dataclass(frozen=True, slots=True)
class MeasurementTypeSpec:
    """Canonical FHIR coding for a supported measurement type.

    Single-value types (e.g. heart rate) leave the `secondary_*` fields
    `None`. Composite types (blood pressure) populate them; the server stores
    them on the same `observations` row so the panel reads atomically.
    """

    code: str
    code_system: str
    unit: str
    # Composite (panel) types only. LOINC sub-code + unit of the second
    # component (e.g. diastolic for blood pressure).
    secondary_code: str | None = None
    secondary_unit: str | None = None


SUPPORTED_MEASUREMENT_TYPES: dict[MeasurementType, MeasurementTypeSpec] = {
    MeasurementType.HEART_RATE: MeasurementTypeSpec(
        code="8867-4",
        code_system="http://loinc.org",
        unit="beats/min",
    ),
    # FHIR `Blood pressure panel` (LOINC 85354-9). Components: systolic
    # (8480-6) on `value` and diastolic (8462-4) on `value_secondary`. Both
    # in mmHg.
    MeasurementType.BLOOD_PRESSURE: MeasurementTypeSpec(
        code="8480-6",
        code_system="http://loinc.org",
        unit="mm[Hg]",
        secondary_code="8462-4",
        secondary_unit="mm[Hg]",
    ),
}


def resolve_measurement_type(key: MeasurementType) -> MeasurementTypeSpec:
    return SUPPORTED_MEASUREMENT_TYPES[key]


def requires_secondary_value(key: MeasurementType) -> bool:
    return SUPPORTED_MEASUREMENT_TYPES[key].secondary_code is not None
