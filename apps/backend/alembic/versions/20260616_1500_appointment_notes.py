"""appointment notes

Revision ID: c4e6a8b0d2f4
Revises: b2d4f6a8c0e2
Create Date: 2026-06-16 15:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c4e6a8b0d2f4"
down_revision: str | None = "b2d4f6a8c0e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "appointment_notes",
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("author_user_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=False),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
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
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_appointment_notes_tenant_id"), "appointment_notes", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_appointment_notes_appointment_id"),
        "appointment_notes",
        ["appointment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_appointment_notes_author_user_id"),
        "appointment_notes",
        ["author_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_appointment_notes_appointment_open",
        "appointment_notes",
        ["appointment_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_appointment_notes_appointment_open",
        table_name="appointment_notes",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_appointment_notes_author_user_id"), table_name="appointment_notes")
    op.drop_index(op.f("ix_appointment_notes_appointment_id"), table_name="appointment_notes")
    op.drop_index(op.f("ix_appointment_notes_tenant_id"), table_name="appointment_notes")
    op.drop_table("appointment_notes")
