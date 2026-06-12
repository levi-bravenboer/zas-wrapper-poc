"""appointment-base

Revision ID: 9f3d2c8b5e41
Revises: e5f48e021dbe
Create Date: 2026-06-11 15:30:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "9f3d2c8b5e41"
down_revision: str | None = "e5f48e021dbe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


APPOINTMENT_KIND_VALUES = ("consultation", "lab", "imaging", "procedure", "other")
APPOINTMENT_STATUS_VALUES = (
    "proposed",
    "pending",
    "booked",
    "arrived",
    "fulfilled",
    "cancelled",
    "noshow",
    "entered_in_error",
    "checked_in",
    "waitlist",
)
APPOINTMENT_MODALITY_VALUES = ("online", "on_site")
APPOINTMENT_PARTICIPANT_ROLE_VALUES = ("lead", "support", "observer")


def upgrade() -> None:
    # Explicit type creation up front; the column defs below use
    # `postgresql.ENUM(create_type=False)` so `op.create_table` does not
    # try to create them a second time (repo precedent:
    # 20260604_1435_access_entitlements_tables.py).
    sa.Enum(*APPOINTMENT_KIND_VALUES, name="appointment_kind").create(op.get_bind())
    sa.Enum(*APPOINTMENT_STATUS_VALUES, name="appointment_status").create(op.get_bind())
    sa.Enum(*APPOINTMENT_MODALITY_VALUES, name="appointment_modality").create(op.get_bind())
    sa.Enum(
        *APPOINTMENT_PARTICIPANT_ROLE_VALUES, name="appointment_participant_role"
    ).create(op.get_bind())

    op.create_table(
        "appointments",
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("pathway_block_instance_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "kind",
            postgresql.ENUM(
                *APPOINTMENT_KIND_VALUES, name="appointment_kind", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "modality",
            postgresql.ENUM(
                *APPOINTMENT_MODALITY_VALUES,
                name="appointment_modality",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("location_text", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                *APPOINTMENT_STATUS_VALUES, name="appointment_status", create_type=False
            ),
            server_default=sa.text("'booked'"),
            nullable=False,
        ),
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
        sa.CheckConstraint(
            "ends_at > starts_at", name="ck_appointments_ends_after_starts"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_appointments_patient_id"),
        "appointments",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_appointments_tenant_id"),
        "appointments",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_appointments_patient_booked_starts_at",
        "appointments",
        ["patient_id", "starts_at"],
        unique=False,
        postgresql_where=sa.text("status = 'booked' AND deleted_at IS NULL"),
    )

    op.create_table(
        "appointment_participants",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM(
                *APPOINTMENT_PARTICIPANT_ROLE_VALUES,
                name="appointment_participant_role",
                create_type=False,
            ),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["appointment_id"], ["appointments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_appointment_participants_appointment_id"),
        "appointment_participants",
        ["appointment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_appointment_participants_tenant_id"),
        "appointment_participants",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_appointment_participants_user_id"),
        "appointment_participants",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "uq_appointment_participants_lead_open",
        "appointment_participants",
        ["appointment_id"],
        unique=True,
        postgresql_where=sa.text("role = 'lead' AND deleted_at IS NULL"),
    )
    op.create_index(
        "uq_appointment_participants_user_open",
        "appointment_participants",
        ["appointment_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_appointment_participants_user_open",
        "appointment_participants",
        ["user_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_appointment_participants_user_open",
        table_name="appointment_participants",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        "uq_appointment_participants_user_open",
        table_name="appointment_participants",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        "uq_appointment_participants_lead_open",
        table_name="appointment_participants",
        postgresql_where=sa.text("role = 'lead' AND deleted_at IS NULL"),
    )
    op.drop_index(
        op.f("ix_appointment_participants_user_id"), table_name="appointment_participants"
    )
    op.drop_index(
        op.f("ix_appointment_participants_tenant_id"), table_name="appointment_participants"
    )
    op.drop_index(
        op.f("ix_appointment_participants_appointment_id"),
        table_name="appointment_participants",
    )
    op.drop_table("appointment_participants")

    op.drop_index(
        "ix_appointments_patient_booked_starts_at",
        table_name="appointments",
        postgresql_where=sa.text("status = 'booked' AND deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_appointments_tenant_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_patient_id"), table_name="appointments")
    op.drop_table("appointments")

    sa.Enum(
        *APPOINTMENT_PARTICIPANT_ROLE_VALUES, name="appointment_participant_role"
    ).drop(op.get_bind())
    sa.Enum(*APPOINTMENT_MODALITY_VALUES, name="appointment_modality").drop(op.get_bind())
    sa.Enum(*APPOINTMENT_STATUS_VALUES, name="appointment_status").drop(op.get_bind())
    sa.Enum(*APPOINTMENT_KIND_VALUES, name="appointment_kind").drop(op.get_bind())
