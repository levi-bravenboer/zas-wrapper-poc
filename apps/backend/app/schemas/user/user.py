from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.enums.user import Role


class UserRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    patient_id: UUID | None = None
    created_at: datetime


class UserDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    patient_id: UUID | None = None
    external_idp: str | None
    external_subject: str | None
    created_at: datetime
    updated_at: datetime


class AssignRoleRequest(BaseModel):
    role: Role


class SetActiveRequest(BaseModel):
    is_active: bool


class UserCreate(BaseModel):
    """Role-discriminated admin-create payload.

    - `admin` branch: requires `display_name`; rejects clinical fields.
    - `caregiver` branch: requires `given_name` + `family_name`; rejects
      `display_name` (the backend derives `user.display_name` from given+family).
      `qualification` is optional.

    The model_validator enforces mutual exclusion so a mixed payload is a 422,
    not a silent half-fill.
    """

    model_config = ConfigDict(extra="forbid")

    email: str
    role: Role
    display_name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    qualification: str | None = None

    @model_validator(mode="after")
    def _check_role_fields(self) -> UserCreate:
        admin_fields = {"display_name": self.display_name}
        caregiver_fields = {
            "given_name": self.given_name,
            "family_name": self.family_name,
            "qualification": self.qualification,
        }
        if self.role == Role.ADMIN:
            if not self.display_name or not self.display_name.strip():
                raise ValueError("admin role requires display_name")
            cross = [k for k, v in caregiver_fields.items() if v is not None]
            if cross:
                raise ValueError(f"admin role forbids: {', '.join(cross)}")
        elif self.role == Role.CAREGIVER:
            if not self.given_name or not self.given_name.strip():
                raise ValueError("caregiver role requires given_name")
            if not self.family_name or not self.family_name.strip():
                raise ValueError("caregiver role requires family_name")
            cross = [k for k, v in admin_fields.items() if v is not None]
            if cross:
                raise ValueError(f"caregiver role forbids: {', '.join(cross)}")
        elif self.role == Role.PATIENT:
            raise ValueError(
                "patient users cannot be created via the admin API; "
                "use the seeding script or a future patient-enrollment flow"
            )
        return self


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
