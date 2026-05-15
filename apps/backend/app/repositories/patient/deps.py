from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.patient.patient_repository import PatientRepository


def get_patient_repository(session: SessionDep) -> PatientRepository:
    return PatientRepository(session)


PatientRepoDep = Annotated[PatientRepository, Depends(get_patient_repository)]
