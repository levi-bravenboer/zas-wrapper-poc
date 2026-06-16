"""Appointment document attachments. Guarded by appointment visibility
(`AppointmentAccessDep`). Bytes transfer directly to/from S3 via presigned
URLs; the API only handles metadata + minting URLs. Uploader may delete own."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums.user import Role
from app.schemas.appointment.attachment import (
    AttachmentCreate,
    AttachmentDownload,
    AttachmentRead,
    AttachmentUploadResponse,
)
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.appointment.attachment_deps import AttachmentServiceDep
from app.services.appointment.deps import AppointmentAccessDep

router = APIRouter(tags=["appointments"])

_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))


@router.get(
    "/appointments/{appointment_id}/attachments",
    operation_id="list_appointment_attachments",
    response_model=list[AttachmentRead],
)
async def list_appointment_attachments(
    appointment: AppointmentAccessDep,
    service: AttachmentServiceDep,
) -> list[AttachmentRead]:
    return await service.list(appointment.id)


@router.post(
    "/appointments/{appointment_id}/attachments",
    operation_id="create_appointment_attachment",
    response_model=AttachmentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_appointment_attachment(
    appointment: AppointmentAccessDep,
    payload: AttachmentCreate,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> AttachmentUploadResponse:
    return await service.create(
        appointment_id=appointment.id,
        uploader=current_user,
        filename=payload.filename,
        content_type=payload.content_type,
        size=payload.size,
    )


@router.get(
    "/appointments/{appointment_id}/attachments/{attachment_id}/url",
    operation_id="get_appointment_attachment_url",
    response_model=AttachmentDownload,
)
async def get_appointment_attachment_url(
    appointment: AppointmentAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> AttachmentDownload:
    del appointment  # visibility already enforced by the dependency
    return await service.download_url(
        attachment_id=attachment_id, tenant_id=current_user.tenant_id
    )


@router.delete(
    "/appointments/{appointment_id}/attachments/{attachment_id}",
    operation_id="delete_appointment_attachment",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_appointment_attachment(
    appointment: AppointmentAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> None:
    del appointment  # visibility already enforced by the dependency
    await service.delete(
        attachment_id=attachment_id,
        tenant_id=current_user.tenant_id,
        caller_id=current_user.id,
    )
