"""Collaboration-domain enums.

`OwnerType` is the polymorphic owner of a generic note / attachment. The
owner row lives in a different domain table (no FK); the collaboration row
carries `owner_type` + `owner_id` to address it, plus `patient_id` for the
patient the item is about.
"""

from __future__ import annotations

from enum import StrEnum


class OwnerType(StrEnum):
    APPOINTMENT = "appointment"
    TASK = "task"
    PATIENT = "patient"
