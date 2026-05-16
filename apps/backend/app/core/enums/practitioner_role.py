"""Practitioner-role-domain enums.

FHIR R4 `PractitionerRole.code` is an extensible codeable concept. The PoC
narrows that to a fixed enum covering the demo personae. Widening to a free
codeable concept is tracked under `BL-062`.
"""

from __future__ import annotations

from enum import StrEnum


class PractitionerRoleCode(StrEnum):
    GP = "gp"
    PHYSIOTHERAPIST = "physiotherapist"
    PSYCHOLOGIST = "psychologist"
    NURSE = "nurse"
    PHYSICIAN = "physician"
    OTHER = "other"
