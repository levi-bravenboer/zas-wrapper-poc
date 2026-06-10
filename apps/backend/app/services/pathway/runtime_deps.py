"""FastAPI dependency wiring for the runtime aggregate services."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.pathway.enrollment_repository import EnrollmentRepository
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.services.pathway.enrollment_service import EnrollmentService


def get_enrollment_service(session: SessionDep) -> EnrollmentService:
    return EnrollmentService(PathwayRepository(session), EnrollmentRepository(session))


EnrollmentServiceDep = Annotated[EnrollmentService, Depends(get_enrollment_service)]


__all__ = ["EnrollmentServiceDep", "get_enrollment_service"]
