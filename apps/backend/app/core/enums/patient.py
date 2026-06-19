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


class LusciiConnectionStatus(StrEnum):
    """Lifecycle of a `patient_luscii_connections` row.

    A patient may carry many connections (one per linked Luscii patient).
    `active` rows are the live links; `inactive` rows are retained for
    history. Deactivation flips the status and keeps the row — `deleted_at`
    stays reserved for true deletion. Persisted as the Postgres enum
    `luscii_connection_status`.
    """

    ACTIVE = "active"
    INACTIVE = "inactive"
