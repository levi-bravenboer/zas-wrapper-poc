# Generic attachment service. Authz-free: the per-entity route enforces owner
# access + resolves owner/patient. Reuses the shared S3 storage; bytes never
# pass through the API (presigned PUT/GET).

from __future__ import annotations

from collections.abc import Sequence
from pathlib import PurePosixPath
from typing import Final
from uuid import UUID, uuid4

from app.core.enums.collaboration import OwnerType
from app.db.models.collaboration import Attachment
from app.repositories.collaboration import AttachmentRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.collaboration.attachment import (
    AttachmentDownload,
    AttachmentRead,
    AttachmentUploadResponse,
)
from app.services.collaboration.errors import (
    AttachmentForbiddenError,
    AttachmentNotFoundError,
    AttachmentTooLargeError,
)
from app.services.storage import S3Storage

MAX_SIZE_BYTES: Final[int] = 50 * 1024 * 1024


def _to_read(att: Attachment, uploader_display_name: str) -> AttachmentRead:
    return AttachmentRead(
        id=att.id,
        owner_type=att.owner_type,
        owner_id=att.owner_id,
        patient_id=att.patient_id,
        filename=att.filename,
        content_type=att.content_type,
        size=att.size,
        uploaded_by=att.uploaded_by,
        uploader_display_name=uploader_display_name,
        created_at=att.created_at,
    )


def _project(rows: Sequence[tuple[Attachment, str]]) -> list[AttachmentRead]:
    return [_to_read(att, name) for att, name in rows]


class AttachmentService:
    def __init__(self, repo: AttachmentRepository, storage: S3Storage) -> None:
        self._repo = repo
        self._storage = storage

    async def list_for_owner(
        self, *, tenant_id: UUID, owner_type: OwnerType, owner_id: UUID
    ) -> list[AttachmentRead]:
        return _project(
            await self._repo.list_for_owner(
                tenant_id=tenant_id, owner_type=owner_type, owner_id=owner_id
            )
        )

    async def list_for_patient(self, *, tenant_id: UUID, patient_id: UUID) -> list[AttachmentRead]:
        return _project(
            await self._repo.list_for_patient(tenant_id=tenant_id, patient_id=patient_id)
        )

    async def create(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        patient_id: UUID,
        uploader: SessionUser,
        filename: str,
        content_type: str,
        size: int,
    ) -> AttachmentUploadResponse:
        if size > MAX_SIZE_BYTES:
            raise AttachmentTooLargeError()
        # Strip any path components from the user-supplied filename so it cannot
        # alter the key prefix; keep the original name on the metadata row.
        safe_name = PurePosixPath(filename.replace("\\", "/")).name or "bestand"
        storage_key = f"{owner_type.value}/{owner_id}/{uuid4()}/{safe_name}"
        att = await self._repo.add(
            owner_type=owner_type,
            owner_id=owner_id,
            patient_id=patient_id,
            uploaded_by=uploader.id,
            filename=filename,
            content_type=content_type,
            size=size,
            storage_key=storage_key,
        )
        upload_url = self._storage.presign_put(storage_key, content_type=content_type)
        return AttachmentUploadResponse(
            attachment=_to_read(att, uploader.display_name), upload_url=upload_url
        )

    async def _get_owned(
        self, *, owner_type: OwnerType, owner_id: UUID, attachment_id: UUID, tenant_id: UUID
    ) -> Attachment:
        att = await self._repo.get(attachment_id=attachment_id, tenant_id=tenant_id)
        # Verify the attachment belongs to the route's owner — the route guards
        # access to THAT owner, so an attachment of a different owner (even in
        # the same tenant) must not be reachable. Mismatch hides as not-found.
        if att is None or att.owner_type != owner_type or att.owner_id != owner_id:
            raise AttachmentNotFoundError()
        return att

    async def download_url(
        self, *, owner_type: OwnerType, owner_id: UUID, attachment_id: UUID, tenant_id: UUID
    ) -> AttachmentDownload:
        att = await self._get_owned(
            owner_type=owner_type, owner_id=owner_id, attachment_id=attachment_id, tenant_id=tenant_id
        )
        return AttachmentDownload(url=self._storage.presign_get(att.storage_key))

    async def delete(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        attachment_id: UUID,
        tenant_id: UUID,
        caller_id: UUID,
    ) -> None:
        att = await self._get_owned(
            owner_type=owner_type, owner_id=owner_id, attachment_id=attachment_id, tenant_id=tenant_id
        )
        if att.uploaded_by != caller_id:
            raise AttachmentForbiddenError()
        await self._repo.soft_delete(att)
