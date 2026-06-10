from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.adapters.deps import LusciiClientDep
from app.db.engine import SessionDep
from app.services.luscii.luscii_service import LusciiService
from app.services.luscii.patient_data_service import LusciiPatientDataService


def get_luscii_service() -> LusciiService:
    return LusciiService()


def get_luscii_patient_data_service(
    session: SessionDep,
    client: LusciiClientDep,
) -> LusciiPatientDataService:
    return LusciiPatientDataService(session, client)


LusciiServiceDep = Annotated[LusciiService, Depends(get_luscii_service)]
LusciiPatientDataServiceDep = Annotated[
    LusciiPatientDataService, Depends(get_luscii_patient_data_service)
]
