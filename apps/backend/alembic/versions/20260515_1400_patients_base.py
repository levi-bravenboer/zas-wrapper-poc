"""patients base

Revision ID: 6b71c4a2d5e1
Revises: 340430029268
Create Date: 2026-05-15 14:00:00.000000

Creates the FHIR-aligned `patients` table (denormalised demographics +
sync seam) and the `patient_identifiers` child table. Adds the `gender`
and `patient_source` Postgres enum types. Partial-unique constraints:

- `patients (tenant_id, external_system, external_ref) WHERE external_ref
  IS NOT NULL AND deleted_at IS NULL` — sync idempotency.
- `patient_identifiers (patient_id, system, value) WHERE deleted_at IS
  NULL` — one identifier of a given system per patient (soft delete frees
  the slot).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "6b71c4a2d5e1"
down_revision: str | None = "340430029268"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Explicit CREATE TYPE so the column-level Enum can stay
    # `create_type=False` and we do not collide with SQLAlchemy's
    # implicit DDL emission for `sa.Enum` instances.
    op.execute("CREATE TYPE gender AS ENUM ('male', 'female', 'other', 'unknown')")
    op.execute("CREATE TYPE patient_source AS ENUM ('local', 'hix', 'luscii')")

    op.create_table(
        "patients",
        sa.Column("primary_organisation_id", sa.UUID(), nullable=False),
        sa.Column("given_name", sa.String(length=255), nullable=False),
        sa.Column("family_name", sa.String(length=255), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column(
            "gender",
            postgresql.ENUM("male", "female", "other", "unknown", name="gender", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "source",
            postgresql.ENUM("local", "hix", "luscii", name="patient_source", create_type=False),
            server_default=sa.text("'local'"),
            nullable=False,
        ),
        sa.Column("external_system", sa.String(length=255), nullable=True),
        sa.Column("external_ref", sa.String(length=255), nullable=True),
        sa.Column("external_version", sa.String(length=64), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["primary_organisation_id"],
            ["organisations.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name="fk_patients_created_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name="fk_patients_updated_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by"],
            ["users.id"],
            name="fk_patients_deleted_by_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_patients_tenant_id"), "patients", ["tenant_id"], unique=False)
    op.create_index(
        op.f("ix_patients_primary_organisation_id"),
        "patients",
        ["primary_organisation_id"],
        unique=False,
    )
    op.create_index(
        "ix_patients_tenant_family_name",
        "patients",
        ["tenant_id", "family_name"],
        unique=False,
    )
    op.create_index(
        "uq_patients_tenant_external",
        "patients",
        ["tenant_id", "external_system", "external_ref"],
        unique=True,
        postgresql_where=sa.text("external_ref IS NOT NULL AND deleted_at IS NULL"),
    )

    op.create_table(
        "patient_identifiers",
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("system", sa.String(length=255), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("use", sa.String(length=32), nullable=True),
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
            name="fk_patient_identifiers_created_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name="fk_patient_identifiers_updated_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by"],
            ["users.id"],
            name="fk_patient_identifiers_deleted_by_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_patient_identifiers_patient_id"),
        "patient_identifiers",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        "ix_patient_identifiers_system_value",
        "patient_identifiers",
        ["system", "value"],
        unique=False,
    )
    op.create_index(
        "uq_patient_identifiers_patient_system_value",
        "patient_identifiers",
        ["patient_id", "system", "value"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_patient_identifiers_patient_system_value", table_name="patient_identifiers")
    op.drop_index("ix_patient_identifiers_system_value", table_name="patient_identifiers")
    op.drop_index(op.f("ix_patient_identifiers_patient_id"), table_name="patient_identifiers")
    op.drop_table("patient_identifiers")

    op.drop_index("uq_patients_tenant_external", table_name="patients")
    op.drop_index("ix_patients_tenant_family_name", table_name="patients")
    op.drop_index(op.f("ix_patients_primary_organisation_id"), table_name="patients")
    op.drop_index(op.f("ix_patients_tenant_id"), table_name="patients")
    op.drop_table("patients")

    op.execute("DROP TYPE patient_source")
    op.execute("DROP TYPE gender")
