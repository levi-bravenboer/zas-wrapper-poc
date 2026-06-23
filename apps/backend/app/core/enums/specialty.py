"""Practitioner specialty codes.

The canonical fixed list of clinical specialties used for `PractitionerRole`
participant matching (pathway enroll-time picker filters on these). The DB
column stays a plain varchar (extensible, like `OrganisationTypeCode`), but the
UI constrains input to this enum and seeds reference it so the vocabulary does
not drift. The frontend mirrors these codes in
`apps/orchestrator/src/modules/practitioner-role/constants.ts`.
"""

from __future__ import annotations

from enum import StrEnum


class SpecialtyCode(StrEnum):
    UROLOGIE = "urologie"
    HUISARTSGENEESKUNDE = "huisartsgeneeskunde"
    RADIOLOGIE = "radiologie"
    PATHOLOGIE = "pathologie"
    ONCOLOGIE = "oncologie"
    CARDIOLOGIE = "cardiologie"
