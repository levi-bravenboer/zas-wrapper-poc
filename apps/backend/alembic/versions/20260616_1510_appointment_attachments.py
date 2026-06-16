"""appointment attachments

Revision ID: d6f8b0c2e4a6
Revises: c4e6a8b0d2f4
Create Date: 2026-06-16 15:10:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d6f8b0c2e4a6"
down_revision: str | None = "c4e6a8b0d2f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "appointment_attachments",
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=False),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_appointment_attachments_storage_key"),
    )
    op.create_index(op.f("ix_appointment_attachments_tenant_id"), "appointment_attachments", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_appointment_attachments_appointment_id"), "appointment_attachments", ["appointment_id"], unique=False)
    op.create_index(op.f("ix_appointment_attachments_uploaded_by"), "appointment_attachments", ["uploaded_by"], unique=False)
    op.create_index(
        "ix_appointment_attachments_appointment_open",
        "appointment_attachments",
        ["appointment_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_appointment_attachments_appointment_open", table_name="appointment_attachments", postgresql_where=sa.text("deleted_at IS NULL"))
    op.drop_index(op.f("ix_appointment_attachments_uploaded_by"), table_name="appointment_attachments")
    op.drop_index(op.f("ix_appointment_attachments_appointment_id"), table_name="appointment_attachments")
    op.drop_index(op.f("ix_appointment_attachments_tenant_id"), table_name="appointment_attachments")
    op.drop_table("appointment_attachments")
