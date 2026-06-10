"""Pathway runtime aggregate tables (slot #3 §1).

Creates `pathway_enrollment`, `pathway_block_execution`, and
`pathway_deferred_field_value` per the chain-slot-#3 D5 hard split:
template state stays on the slot-#1 / slot-#2 tables; runtime state
lives in this aggregate.

Indexes:
- `(enrollment_id, state)` on executions — drives the eligibility
  scan + status dashboards.
- `(enrollment_id, block_template_id, attr)` unique on deferred
  values — one value per spec entry per enrollment.

Revision ID: f1a2b3c4d5e6
Revises: e6f1a2d4c7b8
Create Date: 2026-06-10 10:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID


revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "e6f1a2d4c7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_AUDIT_COLS = [
    sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
    sa.Column(
        "tenant_id",
        PG_UUID(as_uuid=True),
        sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    ),
    sa.Column(
        "created_by",
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    sa.Column(
        "updated_by",
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    sa.Column(
        "deleted_by",
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    ),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    ),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    ),
    sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
]


def upgrade() -> None:
    op.create_table(
        "pathway_enrollment",
        *_AUDIT_COLS,
        sa.Column(
            "patient_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "pathway_version_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_version.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("anchor_date", sa.Date, nullable=False),
        sa.Column(
            "state",
            sa.String(16),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.CheckConstraint(
            "state IN ('active', 'paused', 'completed', 'cancelled')",
            name="ck_pathway_enrollment_state",
        ),
    )
    # Partial unique on `deleted_at IS NULL` so a cancelled or
    # soft-deleted enrollment doesn't permanently block a patient
    # from being re-enrolled on the same pathway version (sibling
    # tables follow the same convention — see e.g. patients_base).
    op.create_index(
        "uq_pathway_enrollment_patient_version_live",
        "pathway_enrollment",
        ["patient_id", "pathway_version_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "pathway_block_execution",
        *_AUDIT_COLS,
        sa.Column(
            "enrollment_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_enrollment.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "block_template_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_block.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "state",
            sa.String(16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("result_json", JSONB, nullable=True),
        sa.Column("decision_output", sa.String(64), nullable=True),
        sa.CheckConstraint(
            "state IN ('pending', 'eligible', 'active', 'completed', 'skipped', 'failed')",
            name="ck_pathway_block_execution_state",
        ),
    )
    # Partial unique: a soft-deleted execution doesn't block
    # rebuilding the runtime aggregate after an enrollment reset.
    op.create_index(
        "uq_pathway_block_execution_enrollment_template_live",
        "pathway_block_execution",
        ["enrollment_id", "block_template_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_pathway_block_execution_enrollment_state",
        "pathway_block_execution",
        ["enrollment_id", "state"],
    )

    op.create_table(
        "pathway_deferred_field_value",
        *_AUDIT_COLS,
        sa.Column(
            "enrollment_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_enrollment.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "block_template_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_block.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("attr", sa.String(64), nullable=False),
        sa.Column("value_json", JSONB, nullable=False),
        sa.Column(
            "set_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "uq_pathway_deferred_field_value_enrollment_block_attr_live",
        "pathway_deferred_field_value",
        ["enrollment_id", "block_template_id", "attr"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_pathway_deferred_field_value_enrollment_block_attr_live",
        table_name="pathway_deferred_field_value",
    )
    op.drop_table("pathway_deferred_field_value")
    op.drop_index(
        "ix_pathway_block_execution_enrollment_state",
        table_name="pathway_block_execution",
    )
    op.drop_index(
        "uq_pathway_block_execution_enrollment_template_live",
        table_name="pathway_block_execution",
    )
    op.drop_table("pathway_block_execution")
    op.drop_index(
        "uq_pathway_enrollment_patient_version_live",
        table_name="pathway_enrollment",
    )
    op.drop_table("pathway_enrollment")
