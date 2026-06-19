from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.collaboration import NoteRepository
from app.services.collaboration.note_service import NoteService
from app.services.storage import StorageDep


def get_note_service(session: SessionDep, storage: StorageDep) -> NoteService:
    return NoteService(NoteRepository(session), storage)


NoteServiceDep = Annotated[NoteService, Depends(get_note_service)]
