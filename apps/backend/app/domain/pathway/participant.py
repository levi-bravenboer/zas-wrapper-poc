"""FHIR `PlanDefinition.action.participant` for materializing blocks.

A block that produces a work primitive (`appointment`/`treatment`/`mdo`/
`task`) declares the required performer as a **care-role code** plus an
optional **specialty** — no person is named at build time. Enrollment
resolves this to an actual `Practitioner` (via the patient's `CareTeam`);
runtime sets it as the `Appointment.participant.actor` / task owner.

`role` draws from the shared FHIR-aligned value set (`role_in_care` /
`PractitionerRole.code`); `specialty` from `PractitionerRole.specialty` /
`Specialism`.
"""

from __future__ import annotations

from pydantic import BaseModel


class ParticipantSpec(BaseModel):
    role: str
    specialty: str | None = None
