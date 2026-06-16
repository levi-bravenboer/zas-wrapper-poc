from __future__ import annotations

from typing import Final
from uuid import UUID, uuid4

from app.repositories.appointment.attachment_repository import (
    AppointmentAttachmentRepository,
)
from app.schemas.appointment.attachment import (
    AttachmentDownload,
    AttachmentRead,
    AttachmentUploadResponse,
)
from app.schemas.auth.auth import SessionUser
from app.services.appointment.attachment_errors import (
    AttachmentForbiddenError,
    AttachmentNotFoundError,
    AttachmentTooLargeError,
)
from app.services.storage import S3Storage

MAX_SIZE_BYTES: Final[int] = 50 * 1024 * 1024


class AppointmentAttachmentService:
    def __init__(
        self, repo: AppointmentAttachmentRepository, storage: S3Storage
    ) -> None:
        self._repo = repo
        self._storage = storage

    async def list(self, appointment_id: UUID, *, tenant_id: UUID) -> list[AttachmentRead]:
        rows = await self._repo.list_for_appointment(appointment_id, tenant_id=tenant_id)
        return [
            AttachmentRead(
                id=att.id,
                filename=att.filename,
                content_type=att.content_type,
                size=att.size,
                uploaded_by=att.uploaded_by,
                uploader_display_name=display_name,
                created_at=att.created_at,
            )
            for att, display_name in rows
        ]

    async def create(
        self,
        *,
        appointment_id: UUID,
        uploader: SessionUser,
        filename: str,
        content_type: str,
        size: int,
    ) -> AttachmentUploadResponse:
        if size > MAX_SIZE_BYTES:
            raise AttachmentTooLargeError()
        storage_key = f"appointments/{appointment_id}/{uuid4()}/{filename}"
        att = await self._repo.add(
            appointment_id=appointment_id,
            uploaded_by=uploader.id,
            filename=filename,
            content_type=content_type,
            size=size,
            storage_key=storage_key,
        )
        upload_url = self._storage.presign_put(storage_key, content_type=content_type)
        return AttachmentUploadResponse(
            attachment=AttachmentRead(
                id=att.id,
                filename=att.filename,
                content_type=att.content_type,
                size=att.size,
                uploaded_by=att.uploaded_by,
                uploader_display_name=uploader.display_name,
                created_at=att.created_at,
            ),
            upload_url=upload_url,
        )

    async def download_url(
        self, *, attachment_id: UUID, tenant_id: UUID
    ) -> AttachmentDownload:
        att = await self._repo.get(attachment_id=attachment_id, tenant_id=tenant_id)
        if att is None:
            raise AttachmentNotFoundError()
        return AttachmentDownload(url=self._storage.presign_get(att.storage_key))

    async def delete(self, *, attachment_id: UUID, tenant_id: UUID, caller_id: UUID) -> None:
        att = await self._repo.get(attachment_id=attachment_id, tenant_id=tenant_id)
        if att is None:
            raise AttachmentNotFoundError()
        if att.uploaded_by != caller_id:
            raise AttachmentForbiddenError()
        await self._repo.soft_delete(att)
