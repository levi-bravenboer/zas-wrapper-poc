from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, SecretStr


class MobileLoginRequest(BaseModel):
    tenant: str
    email: str
    password: SecretStr


class PatientSession(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    given_name: str
    patient_id: UUID
    tenant_id: UUID


class MobileLoginResponse(BaseModel):
    session: PatientSession
