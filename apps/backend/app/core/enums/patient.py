"""Patient-domain enums.

`Gender` mirrors the FHIR R4 `administrative-gender` value set
(`http://hl7.org/fhir/ValueSet/administrative-gender`). The four canonical
codes are required; we expose them as a `StrEnum` so they round-trip cleanly
through JSON and query params.

`PatientSource` tags the system of record for a patient row:

- `local`  — created via our own API (PoC seed + tests).
- `hix`    — synced from the HiX EHR via the HiX adapter (MVP scope).
- `luscii` — synced from the Luscii platform (MVP scope).

`source` plus `(external_system, external_ref)` is what the future sync
layer uses to upsert idempotently. The values are persisted as a Postgres
enum (`patient_source`).
"""

from __future__ import annotations

from enum import StrEnum


class Gender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNKNOWN = "unknown"


class PatientSource(StrEnum):
    LOCAL = "local"
    HIX = "hix"
    LUSCII = "luscii"
