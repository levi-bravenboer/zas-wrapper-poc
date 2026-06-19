"""create patient_luscii_connections table

Revision ID: lscconn00001
Revises: md0outc0me01
Create Date: 2026-06-17 11:00:00.000000

Data layer for `patient-luscii-connection`: a status-bearing link letting one
of our patients connect to MANY Luscii patients. Backfills one `active`
connection per existing live `urn:zas:luscii:patient` identifier so the new
table is populated, but LEAVES the identifier rows in place — the link service
still reads them until a later step re-points it at this table.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "lscconn00001"
down_revision: str | None = "md0outc0me01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Explicit CREATE TYPE so the column-level Enum stays create_type=False
    # (matches the gender / patient_source pattern in patients-base).
    op.execute("CREATE TYPE luscii_connection_status AS ENUM ('active', 'inactive')")

    op.create_table(
        "patient_luscii_connections",
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("luscii_patient_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "inactive",
                name="luscii_connection_status",
                create_type=False,
            ),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column("program_id", sa.String(length=128), nullable=True),
        sa.Column("program_name", sa.String(length=255), nullable=True),
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
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name="fk_patient_luscii_connections_created_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name="fk_patient_luscii_connections_updated_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by"],
            ["users.id"],
            name="fk_patient_luscii_connections_deleted_by_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_patient_luscii_connections_patient_id"),
        "patient_luscii_connections",
        ["patient_id"],
        unique=False,
    )
    # One ACTIVE connection per Luscii patient across all our patients.
    op.create_index(
        "uq_patient_luscii_connections_active_luscii_patient",
        "patient_luscii_connections",
        ["luscii_patient_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active' AND deleted_at IS NULL"),
    )
    # One live row per (patient, luscii patient) — re-link reuses the row.
    op.create_index(
        "uq_patient_luscii_connections_patient_luscii",
        "patient_luscii_connections",
        ["patient_id", "luscii_patient_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # Backfill: one active connection per live Luscii identifier. The existing
    # partial-unique `uq_patient_identifiers_luscii_value` guarantees the
    # source set is unique across patients, so this cannot violate the new
    # active-luscii-patient index. Identifier rows are intentionally untouched.
    op.execute(
        """
        INSERT INTO patient_luscii_connections (
            id, patient_id, luscii_patient_id, status,
            created_by, updated_by, created_at, updated_at
        )
        SELECT
            gen_random_uuid(), pi.patient_id, pi.value::uuid, 'active',
            pi.created_by, pi.updated_by, now(), now()
        FROM patient_identifiers pi
        WHERE pi.system = 'urn:zas:luscii:patient'
          AND pi.deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index(
        "uq_patient_luscii_connections_patient_luscii",
        table_name="patient_luscii_connections",
    )
    op.drop_index(
        "uq_patient_luscii_connections_active_luscii_patient",
        table_name="patient_luscii_connections",
    )
    op.drop_index(
        op.f("ix_patient_luscii_connections_patient_id"),
        table_name="patient_luscii_connections",
    )
    op.drop_table("patient_luscii_connections")
    op.execute("DROP TYPE luscii_connection_status")
