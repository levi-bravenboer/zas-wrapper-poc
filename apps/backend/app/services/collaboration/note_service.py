# Generic note service. A note carries text and/or a file — a file is just a
# note with a file. Authz-free: the per-entity route enforces owner access and
# resolves the owner + patient before calling here. File bytes never pass
# through the API (presigned PUT/GET on the shared S3 storage).

from __future__ import annotations

from collections.abc import Sequence
from pathlib import PurePosixPath
from typing import Final
from uuid import UUID, uuid4

from app.core.enums.collaboration import OwnerType
from app.db.models.collaboration import Note
from app.repositories.collaboration import NoteRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.collaboration.note import (
    NoteDownload,
    NoteFileCreate,
    NoteRead,
    NoteUploadResponse,
)
from app.services.collaboration.errors import (
    NoteForbiddenError,
    NoteHasNoFileError,
    NoteNotFoundError,
    NoteTooLargeError,
)
from app.services.storage import S3Storage

MAX_FILE_SIZE_BYTES: Final[int] = 50 * 1024 * 1024


def _to_read(note: Note, author_display_name: str) -> NoteRead:
    return NoteRead(
        id=note.id,
        owner_type=note.owner_type,
        owner_id=note.owner_id,
        patient_id=note.patient_id,
        author_user_id=note.author_user_id,
        author_display_name=author_display_name,
        body=note.body,
        filename=note.filename,
        content_type=note.content_type,
        size=note.size,
        created_at=note.created_at,
    )


def _project(rows: Sequence[tuple[Note, str]]) -> list[NoteRead]:
    return [_to_read(note, name) for note, name in rows]


class NoteService:
    def __init__(self, repo: NoteRepository, storage: S3Storage) -> None:
        self._repo = repo
        self._storage = storage

    async def list_for_owner(
        self, *, tenant_id: UUID, owner_type: OwnerType, owner_id: UUID
    ) -> list[NoteRead]:
        return _project(
            await self._repo.list_for_owner(
                tenant_id=tenant_id, owner_type=owner_type, owner_id=owner_id
            )
        )

    async def list_for_patient(self, *, tenant_id: UUID, patient_id: UUID) -> list[NoteRead]:
        reads = _project(
            await self._repo.list_for_patient(tenant_id=tenant_id, patient_id=patient_id)
        )
        # Aggregate view: tag each note with where it lives so the patient view
        # shows the source. Patient-owned notes need no label (they're here).
        ids_by_type: dict[OwnerType, set[UUID]] = {}
        for read in reads:
            if read.owner_type is OwnerType.PATIENT:
                continue
            ids_by_type.setdefault(read.owner_type, set()).add(read.owner_id)
        if ids_by_type:
            labels = await self._repo.owner_labels(tenant_id=tenant_id, ids_by_type=ids_by_type)
            for read in reads:
                if read.owner_type is not OwnerType.PATIENT:
                    read.owner_label = labels.get(read.owner_id)
        return reads

    async def add(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        patient_id: UUID | None,
        author: SessionUser,
        body: str | None,
        file: NoteFileCreate | None = None,
    ) -> NoteUploadResponse:
        storage_key: str | None = None
        upload_url: str | None = None
        if file is not None:
            if file.size > MAX_FILE_SIZE_BYTES:
                raise NoteTooLargeError()
            # Strip path components from the user-supplied filename so it cannot
            # alter the key prefix; keep the original name on the metadata row.
            safe_name = PurePosixPath(file.filename.replace("\\", "/")).name or "bestand"
            storage_key = f"{owner_type.value}/{owner_id}/{uuid4()}/{safe_name}"
        note = await self._repo.add(
            owner_type=owner_type,
            owner_id=owner_id,
            patient_id=patient_id,
            author_user_id=author.id,
            body=body.strip() if body and body.strip() else None,
            filename=file.filename if file else None,
            content_type=file.content_type if file else None,
            size=file.size if file else None,
            storage_key=storage_key,
        )
        if file is not None and storage_key is not None:
            upload_url = self._storage.presign_put(storage_key, content_type=file.content_type)
        return NoteUploadResponse(note=_to_read(note, author.display_name), upload_url=upload_url)

    async def _get_owned(
        self, *, owner_type: OwnerType, owner_id: UUID, note_id: UUID, tenant_id: UUID
    ) -> Note:
        note = await self._repo.get(note_id=note_id, tenant_id=tenant_id)
        # Verify the note belongs to the route's owner — the route guards access
        # to THAT owner, so a note of a different owner (even in the same tenant)
        # must not be reachable. Mismatch hides as not-found.
        if note is None or note.owner_type != owner_type or note.owner_id != owner_id:
            raise NoteNotFoundError()
        return note

    async def download_url(
        self, *, owner_type: OwnerType, owner_id: UUID, note_id: UUID, tenant_id: UUID
    ) -> NoteDownload:
        note = await self._get_owned(
            owner_type=owner_type, owner_id=owner_id, note_id=note_id, tenant_id=tenant_id
        )
        if note.storage_key is None:
            raise NoteHasNoFileError()
        return NoteDownload(url=self._storage.presign_get(note.storage_key))

    async def delete(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        note_id: UUID,
        tenant_id: UUID,
        caller_id: UUID,
    ) -> None:
        note = await self._get_owned(
            owner_type=owner_type, owner_id=owner_id, note_id=note_id, tenant_id=tenant_id
        )
        if note.author_user_id != caller_id:
            raise NoteForbiddenError()
        await self._repo.soft_delete(note)
