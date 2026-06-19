from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class UserRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role_id: UUID
    is_active: bool
    patient_id: UUID | None = None
    created_at: datetime


class UserDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role_id: UUID
    is_active: bool
    patient_id: UUID | None = None
    external_idp: str | None
    external_subject: str | None
    created_at: datetime
    updated_at: datetime


class AssignRoleRequest(BaseModel):
    role_id: UUID


class SetActiveRequest(BaseModel):
    is_active: bool


class UserCreate(BaseModel):
    """Admin-create payload for a staff user (`dynamic-rbac-roles-permissions`).

    `role_id` is the RBAC role to bind. Identity-type is derived from data, so
    the payload is discriminated by the *clinical* fields, not the role:

    - clinician branch (a `Practitioner` row will be created): requires
      `given_name` + `family_name`; rejects `display_name` (derived from
      given+family). `qualification` optional.
    - non-clinician branch (e.g. an admin user): requires `display_name`;
      rejects clinical fields.

    Patients are NOT created here — they have no clinical fields and carry a
    `patient_id`, set only by the seeding / enrollment flow.
    """

    model_config = ConfigDict(extra="forbid")

    email: str
    role_id: UUID
    display_name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    qualification: str | None = None

    @property
    def is_clinician(self) -> bool:
        return bool(self.given_name or self.family_name or self.qualification)

    @model_validator(mode="after")
    def _check_fields(self) -> UserCreate:
        admin_fields = {"display_name": self.display_name}
        clinical_fields = {
            "given_name": self.given_name,
            "family_name": self.family_name,
            "qualification": self.qualification,
        }
        if self.is_clinician:
            if not self.given_name or not self.given_name.strip():
                raise ValueError("clinician user requires given_name")
            if not self.family_name or not self.family_name.strip():
                raise ValueError("clinician user requires family_name")
            cross = [k for k, v in admin_fields.items() if v is not None]
            if cross:
                raise ValueError(f"clinician user forbids: {', '.join(cross)}")
        else:
            if not self.display_name or not self.display_name.strip():
                raise ValueError("non-clinician user requires display_name")
            cross = [k for k, v in clinical_fields.items() if v is not None]
            if cross:
                raise ValueError(f"non-clinician user forbids: {', '.join(cross)}")
        return self


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
