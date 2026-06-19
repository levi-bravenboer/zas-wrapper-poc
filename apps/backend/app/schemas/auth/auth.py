from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, SecretStr


class LoginRequest(BaseModel):
    email: str
    password: SecretStr


class SessionUser(BaseModel):
    """The bound actor for a request (`dynamic-rbac-roles-permissions`).

    `role` is no longer an enum — a user row points at a `roles` row
    (`role_id`) whose assigned permission slugs are resolved into
    `permissions` at actor-resolution time. `role_slug` is the bound role's
    stable slug (e.g. `admin`, `default`). `patient_id` is set iff this is a
    patient (mobile data-subject) row — identity-type is derived from data,
    not the role.
    """

    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: UUID
    email: str
    display_name: str
    tenant_id: UUID
    role_id: UUID
    role_slug: str
    permissions: frozenset[str]
    patient_id: UUID | None = None

    @property
    def is_patient(self) -> bool:
        return self.patient_id is not None

    def has_permission(self, slug: str) -> bool:
        return slug in self.permissions


class RoleOption(BaseModel):
    """One selectable user row for a multi-row human. Identified by `user_id`
    (slugs collide when a human is both patient and caregiver — both `default`)
    and labelled by role slug + the patient facet."""

    user_id: UUID
    role_slug: str
    is_patient: bool = False


class RoleSelectionRequiredResponse(BaseModel):
    """Login succeeded but the human holds several user rows on this surface
    (REQ-NON-3). The session cookie is set and live; protected routes answer
    409 until `POST /auth/session/role` binds one of `available_roles`."""

    requires_role_selection: Literal[True] = True
    available_roles: list[RoleOption]


class RoleSelectRequest(BaseModel):
    # Selects a user row by id — slugs can collide (patient + caregiver both
    # carry the `default` role), so the row id is the unambiguous selector.
    user_id: UUID
