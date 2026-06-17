from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums.collaboration import OwnerType


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_type: OwnerType
    owner_id: UUID
    patient_id: UUID | None
    author_user_id: UUID
    author_display_name: str
    # Text content; null for a file-only note.
    body: str | None
    # File payload; all null for a text-only note.
    filename: str | None
    content_type: str | None
    size: int | None
    created_at: datetime
    # Where the note lives (appointment title / task title / pathway-step name).
    # Resolved only in the patient aggregate so the patient view shows each
    # note's source; null for patient-owned notes and per-owner lists.
    owner_label: str | None = None


class NoteFileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=0)


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str | None = None
    # When set, the note carries a file: the create response includes a
    # presigned PUT URL the client uploads the bytes to.
    file: NoteFileCreate | None = None

    @model_validator(mode="after")
    def _require_content(self) -> NoteCreate:
        has_text = bool(self.body and self.body.strip())
        if not has_text and self.file is None:
            raise ValueError("A note must carry text or a file.")
        return self


class NoteUploadResponse(BaseModel):
    note: NoteRead
    # Presigned S3 PUT URL when the note carries a file; null for a text note.
    upload_url: str | None = None


class NoteDownload(BaseModel):
    url: str
