"""Appointment-domain enums.

`AppointmentKind` is a PoC domain enum (`consultation | lab | imaging |
procedure | other`). At MVP it maps to FHIR R4 `Appointment.serviceType` /
`Appointment.specialty` codings through the HiX adapter; the v1 enum is the
source of truth in PoC.

`AppointmentStatus` mirrors the full FHIR R4 `AppointmentStatus` value set
(`http://hl7.org/fhir/ValueSet/appointmentstatus`). The FHIR code
`entered-in-error` has a hyphen, which is illegal in a Python identifier;
we store the symbol as `ENTERED_IN_ERROR` / value `entered_in_error` and
the serialiser at the projection boundary swaps the underscore for a
hyphen on the wire. The scenario in `tasks-base` locks that round-trip.

`AppointmentModality` distinguishes `online | on_site` clinical encounters.
When `modality = 'on_site'`, `appointments.location_text` MUST be
non-empty — enforced by `AppointmentValidator`, not the DB, so future test
fixtures and adapter writers express the rule once at the validator
boundary.

`AppointmentParticipantRole` carries the three PoC roles
(`lead | support | observer`). A partial unique index enforces exactly
one active `lead` per appointment as defence-in-depth against a buggy
writer; the validator enforces it at write time.
"""

from __future__ import annotations

from enum import StrEnum


class AppointmentKind(StrEnum):
    CONSULTATION = "consultation"
    LAB = "lab"
    IMAGING = "imaging"
    PROCEDURE = "procedure"
    OTHER = "other"


class AppointmentStatus(StrEnum):
    PROPOSED = "proposed"
    PENDING = "pending"
    BOOKED = "booked"
    ARRIVED = "arrived"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    NOSHOW = "noshow"
    ENTERED_IN_ERROR = "entered_in_error"
    CHECKED_IN = "checked_in"
    WAITLIST = "waitlist"


class AppointmentModality(StrEnum):
    ONLINE = "online"
    ON_SITE = "on_site"


class AppointmentParticipantRole(StrEnum):
    LEAD = "lead"
    SUPPORT = "support"
    OBSERVER = "observer"
