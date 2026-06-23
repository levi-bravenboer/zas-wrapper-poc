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


@dataclass(frozen=True, slots=True)
class MeasurementTypeSpec:
    code: str
    code_system: str
    unit: str


SUPPORTED_MEASUREMENT_TYPES: dict[MeasurementType, MeasurementTypeSpec] = {
    MeasurementType.HEART_RATE: MeasurementTypeSpec(
        code="8867-4",
        code_system="http://loinc.org",
        unit="beats/min",
    ),
}


def resolve_measurement_type(key: MeasurementType) -> MeasurementTypeSpec:
    return SUPPORTED_MEASUREMENT_TYPES[key]
