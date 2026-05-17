from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.patient import Gender, PatientSource
from app.schemas.patient.patient_identifier import (
    PatientIdentifierCreate,
    PatientIdentifierRead,
)


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    primary_organisation_id: UUID
    given_name: str
    family_name: str
    birth_date: date | None = None
    gender: Gender
    source: PatientSource
    external_system: str | None = None
    external_ref: str | None = None
    external_version: str | None = None
    last_synced_at: datetime | None = None
    identifiers: list[PatientIdentifierRead] = []
    # Audit metadata — surfaced for the patient profile history panel.
    # These columns are stamped by the `before_flush` audit hook on the base
    # entity classes; exposing them lets the UI render a minimal timeline
    # without a dedicated audit-log table.
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    created_by: UUID
    updated_by: UUID
    deleted_by: UUID | None = None


class PatientCreate(BaseModel):
    """`POST /patients` payload.

    `identifiers` is part of the create payload so a patient can be born
    with an INSZ in a single transaction. Updating identifiers later goes
    through a dedicated endpoint (out of scope for `patients-base`); the
    PATCH route rejects the field outright (see `PatientUpdate`).
    """

    primary_organisation_id: UUID
    given_name: str
    family_name: str
    birth_date: date | None = None
    gender: Gender
    source: PatientSource = PatientSource.LOCAL
    external_system: str | None = None
    external_ref: str | None = None
    external_version: str | None = None
    identifiers: list[PatientIdentifierCreate] = []


class PatientUpdate(BaseModel):
    """`PATCH /patients/{id}` payload — demographics only.

    `model_config = ConfigDict(extra="forbid")` is what produces the 422
    when a client sends `identifiers` here: FastAPI translates Pydantic's
    `extra_forbidden` error into a 422 response automatically.
    """

    model_config = ConfigDict(extra="forbid")

    given_name: str | None = None
    family_name: str | None = None
    birth_date: date | None = None
    gender: Gender | None = None
    primary_organisation_id: UUID | None = None
