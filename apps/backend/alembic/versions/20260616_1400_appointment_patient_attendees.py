"""appointment patient attendees

Revision ID: a1c0d2e4f6b8
Revises: cab2e2caecfa
Create Date: 2026-06-16 14:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1c0d2e4f6b8"
down_revision: str | None = "cab2e2caecfa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "appointment_patient_attendees",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_appointment_patient_attendees_tenant_id"),
        "appointment_patient_attendees",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_appointment_patient_attendees_appointment_id"),
        "appointment_patient_attendees",
        ["appointment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_appointment_patient_attendees_patient_id"),
        "appointment_patient_attendees",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        "uq_appointment_patient_attendees_open",
        "appointment_patient_attendees",
        ["appointment_id", "patient_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_appointment_patient_attendees_patient_open",
        "appointment_patient_attendees",
        ["patient_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_appointment_patient_attendees_patient_open", table_name="appointment_patient_attendees", postgresql_where=sa.text("deleted_at IS NULL"))
    op.drop_index("uq_appointment_patient_attendees_open", table_name="appointment_patient_attendees", postgresql_where=sa.text("deleted_at IS NULL"))
    op.drop_index(op.f("ix_appointment_patient_attendees_patient_id"), table_name="appointment_patient_attendees")
    op.drop_index(op.f("ix_appointment_patient_attendees_appointment_id"), table_name="appointment_patient_attendees")
    op.drop_index(op.f("ix_appointment_patient_attendees_tenant_id"), table_name="appointment_patient_attendees")
    op.drop_table("appointment_patient_attendees")
