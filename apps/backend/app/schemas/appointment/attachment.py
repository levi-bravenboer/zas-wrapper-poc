from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    content_type: str
    size: int
    uploaded_by: UUID
    uploader_display_name: str
    created_at: datetime


class AttachmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=0)


class AttachmentUploadResponse(BaseModel):
    attachment: AttachmentRead
    upload_url: str


class AttachmentDownload(BaseModel):
    url: str
