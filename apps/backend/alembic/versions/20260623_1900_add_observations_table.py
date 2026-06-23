"""add observations table

Adds the `observations` table for locally-entered measurements (manual log),
distinct from the Luscii read-only proxy. FHIR `Observation` subset: code +
unit are server-derived from the supported-type allow-list; numeric value;
effective timestamp; performer (caregiver). Standard TenantOwnedEntity audit
columns (tenant_id, created/updated/deleted_at + _by) inherited from the base.

Revision ID: a1f9c4d23b87
Revises: e167e9701113
Create Date: 2026-06-23 19:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "a1f9c4d23b87"
down_revision: str | None = "e167e9701113"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "observations",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
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
            "tenant_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("code_system", sa.String(255), nullable=False),
        sa.Column("value", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.Column("effective_date_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "performer_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    op.create_index("ix_observations_tenant_id", "observations", ["tenant_id"])
    op.create_index("ix_observations_patient_id", "observations", ["patient_id"])
    op.create_index(
        "ix_observations_patient_effective",
        "observations",
        ["patient_id", "effective_date_time"],
    )


def downgrade() -> None:
    op.drop_index("ix_observations_patient_effective", table_name="observations")
    op.drop_index("ix_observations_patient_id", table_name="observations")
    op.drop_index("ix_observations_tenant_id", table_name="observations")
    op.drop_table("observations")
