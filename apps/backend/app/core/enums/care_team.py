"""Care-team-domain enums.

FHIR R4 `CareTeam.status` has the full code set `proposed | active |
suspended | inactive | entered-in-error`. The PoC narrows that to the two
states the demo needs — `active` and `inactive`. Widening to the full set
is additive (no row-level migration; only the Postgres enum gains values).

`RoleInCare` maps to FHIR `CareTeam.participant.role`, which is an
extensible codeable concept. We persist the three PoC-tier codes that the
demo wires up (`primary | consulting | observer`). MVP will widen to the
free codeable concept per `BL` follow-up.
"""

from __future__ import annotations

from enum import StrEnum


class RoleInCare(StrEnum):
    PRIMARY = "primary"
    CONSULTING = "consulting"
    OBSERVER = "observer"


class CareTeamStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
