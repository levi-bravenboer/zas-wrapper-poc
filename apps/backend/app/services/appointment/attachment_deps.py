from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.appointment.attachment_repository import (
    AppointmentAttachmentRepository,
)
from app.services.appointment.attachment_service import AppointmentAttachmentService
from app.services.storage import StorageDep


def get_attachment_service(
    session: SessionDep, storage: StorageDep
) -> AppointmentAttachmentService:
    return AppointmentAttachmentService(AppointmentAttachmentRepository(session), storage)


AttachmentServiceDep = Annotated[
    AppointmentAttachmentService, Depends(get_attachment_service)
]
