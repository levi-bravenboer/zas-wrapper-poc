"""generic notes and attachments; drop appointment-specific

Revision ID: e8a0c2d4f6b9
Revises: d6f8b0c2e4a6
Create Date: 2026-06-16 16:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e8a0c2d4f6b9"
down_revision: str | None = "d6f8b0c2e4a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: the type is created once via `.create()` below; without it
# each `create_table` using the column re-emits CREATE TYPE and the upgrade
# fails with "type owner_type already exists".
_OWNER_TYPE = postgresql.ENUM(
    "appointment", "task", "patient", name="owner_type", create_type=False
)

_AUDIT_COLS = (
    ("tenant_id", sa.UUID(), False),
    ("created_by", sa.UUID(), False),
    ("updated_by", sa.UUID(), False),
    ("deleted_by", sa.UUID(), True),
)


def _common_columns() -> list[sa.Column]:
    cols = [sa.Column(name, type_, nullable=nullable) for name, type_, nullable in _AUDIT_COLS]
    cols += [
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    ]
    return cols


def _audit_fks() -> list[sa.ForeignKeyConstraint]:
    return [
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
    ]


def upgrade() -> None:
    # drop appointment-specific collaboration (replaced by generic)
    op.drop_index(
        "ix_appointment_notes_appointment_open",
        table_name="appointment_notes",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_appointment_notes_author_user_id"), table_name="appointment_notes")
    op.drop_index(op.f("ix_appointment_notes_appointment_id"), table_name="appointment_notes")
    op.drop_index(op.f("ix_appointment_notes_tenant_id"), table_name="appointment_notes")
    op.drop_table("appointment_notes")
    op.drop_index(
        "ix_appointment_attachments_appointment_open",
        table_name="appointment_attachments",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        op.f("ix_appointment_attachments_uploaded_by"), table_name="appointment_attachments"
    )
    op.drop_index(
        op.f("ix_appointment_attachments_appointment_id"), table_name="appointment_attachments"
    )
    op.drop_index(
        op.f("ix_appointment_attachments_tenant_id"), table_name="appointment_attachments"
    )
    op.drop_table("appointment_attachments")

    _OWNER_TYPE.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notes",
        sa.Column("owner_type", _OWNER_TYPE, nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("author_user_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        *_common_columns(),
        *_audit_fks(),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notes_tenant_id"), "notes", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_notes_patient_id"), "notes", ["patient_id"], unique=False)
    op.create_index(op.f("ix_notes_author_user_id"), "notes", ["author_user_id"], unique=False)
    op.create_index(
        "ix_notes_owner_open",
        "notes",
        ["owner_type", "owner_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_notes_patient_open",
        "notes",
        ["patient_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "attachments",
        sa.Column("owner_type", _OWNER_TYPE, nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        *_common_columns(),
        *_audit_fks(),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_attachments_storage_key"),
    )
    op.create_index(op.f("ix_attachments_tenant_id"), "attachments", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_attachments_patient_id"), "attachments", ["patient_id"], unique=False)
    op.create_index(
        op.f("ix_attachments_uploaded_by"), "attachments", ["uploaded_by"], unique=False
    )
    op.create_index(
        "ix_attachments_owner_open",
        "attachments",
        ["owner_type", "owner_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_attachments_patient_open",
        "attachments",
        ["patient_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    raise NotImplementedError("forward-only: generic collaboration replaces appointment-specific")
