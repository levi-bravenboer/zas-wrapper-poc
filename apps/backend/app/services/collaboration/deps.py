from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.collaboration import AttachmentRepository, NoteRepository
from app.services.collaboration.attachment_service import AttachmentService
from app.services.collaboration.note_service import NoteService
from app.services.storage import StorageDep


def get_note_service(session: SessionDep) -> NoteService:
    return NoteService(NoteRepository(session))


def get_attachment_service(session: SessionDep, storage: StorageDep) -> AttachmentService:
    return AttachmentService(AttachmentRepository(session), storage)


NoteServiceDep = Annotated[NoteService, Depends(get_note_service)]
AttachmentServiceDep = Annotated[AttachmentService, Depends(get_attachment_service)]
