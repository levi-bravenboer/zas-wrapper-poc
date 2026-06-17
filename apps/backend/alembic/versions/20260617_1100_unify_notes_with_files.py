"""unify notes with files; migrate attachments into notes

A file becomes "just a note with a file": notes gain optional file columns,
every attachment row is moved into notes (body NULL, uploaded_by -> author),
then the attachments table is dropped. Forward-only.

Revision ID: n0tef1les001
Revises: md0outc0me01
Create Date: 2026-06-17 11:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "n0tef1les001"
down_revision: str | None = "md0outc0me01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. notes gain optional file payload columns.
    op.add_column("notes", sa.Column("filename", sa.String(length=255), nullable=True))
    op.add_column("notes", sa.Column("content_type", sa.String(length=255), nullable=True))
    op.add_column("notes", sa.Column("size", sa.Integer(), nullable=True))
    op.add_column("notes", sa.Column("storage_key", sa.String(length=512), nullable=True))
    op.create_unique_constraint("uq_notes_storage_key", "notes", ["storage_key"])

    # 2. a file-only note carries no text -> body becomes nullable.
    op.alter_column("notes", "body", existing_type=sa.Text(), nullable=True)

    # 3. move every attachment into notes (ids + audit trail preserved, uploader
    #    becomes the author, body stays NULL — the file is the note).
    op.execute(
        sa.text(
            """
            INSERT INTO notes (
                owner_type, owner_id, patient_id, author_user_id, body,
                filename, content_type, size, storage_key,
                tenant_id, created_by, updated_by, deleted_by,
                id, created_at, updated_at, deleted_at
            )
            SELECT
                owner_type, owner_id, patient_id, uploaded_by, NULL,
                filename, content_type, size, storage_key,
                tenant_id, created_by, updated_by, deleted_by,
                id, created_at, updated_at, deleted_at
            FROM attachments
            """
        )
    )

    # 4. a note must carry text or a file (now that file-only rows exist).
    op.create_check_constraint(
        "ck_notes_body_or_file", "notes", "body IS NOT NULL OR storage_key IS NOT NULL"
    )

    # 5. drop the now-empty attachments table (indexes go with it). The shared
    #    owner_type enum stays — notes still use it.
    op.drop_table("attachments")


def downgrade() -> None:
    raise NotImplementedError("forward-only: attachments are unified into notes")
