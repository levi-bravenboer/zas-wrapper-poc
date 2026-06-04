"""add patient role and patient id to users

Revision ID: 7614fd4e8ece
Revises: f66286821872
Create Date: 2026-06-03 06:19:55.016684

Migration plan:
- Extend `role` enum with `'patient'` (non-destructive in Postgres).
- Add `users.patient_id UUID NULL REFERENCES patients(id) ON DELETE RESTRICT`.
- Add UNIQUE partial index `uq_users_patient_id` (1:1 patient↔user; caregivers
  with NULL `patient_id` excluded).
- Add CHECK `ck_users_role_patient_link` linking `role = 'patient'` to
  `patient_id IS NOT NULL` and vice versa.
- Swap email-uniqueness from `(tenant_id, lower(email))` to
  `(tenant_id, lower(email), role)` so a caregiver and a patient in the same
  tenant may share an email.

`patients` table is unchanged — the auth entity is the `users` row that
references the `patients` row, not the `patients` row itself.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "7614fd4e8ece"
down_revision: str | None = "f66286821872"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Extend the `role` Postgres enum. ALTER TYPE ... ADD VALUE cannot
    # run inside a transaction in Postgres — commit the alembic-opened
    # transaction, execute, then re-open for the remaining DDL.
    op.execute(sa.text("COMMIT"))
    op.execute(sa.text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'patient'"))
    op.execute(sa.text("BEGIN"))

    # New FK column from users to patients.
    op.add_column("users", sa.Column("patient_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_users_patient_id_patients",
        source_table="users",
        referent_table="patients",
        local_cols=["patient_id"],
        remote_cols=["id"],
        ondelete="RESTRICT",
    )

    # 1:1 partial unique — caregivers (NULL patient_id) are not constrained.
    op.create_index(
        "uq_users_patient_id",
        "users",
        ["patient_id"],
        unique=True,
        postgresql_where=sa.text("patient_id IS NOT NULL"),
    )

    # Role ↔ patient_id link constraint.
    op.create_check_constraint(
        "ck_users_role_patient_link",
        "users",
        "(role = 'patient' AND patient_id IS NOT NULL)"
        " OR (role <> 'patient' AND patient_id IS NULL)",
    )

    # Swap email-uniqueness from (tenant, lower(email)) to
    # (tenant, lower(email), role).
    op.drop_index("uq_users_tenant_id_lower_email", table_name="users")
    op.create_index(
        "uq_users_tenant_id_lower_email_role",
        "users",
        [sa.text("tenant_id"), sa.text("lower(email)"), sa.text("role")],
        unique=True,
    )


def downgrade() -> None:
    # Remove patient-role users BEFORE restoring the strict email-uniqueness
    # index — otherwise a caregiver+patient sharing an email would violate
    # the old (tenant, email) unique constraint.
    op.execute(sa.text("DELETE FROM users WHERE role = 'patient'"))

    op.drop_constraint("ck_users_role_patient_link", "users", type_="check")
    op.drop_index("uq_users_patient_id", table_name="users")
    op.drop_constraint("fk_users_patient_id_patients", "users", type_="foreignkey")
    op.drop_column("users", "patient_id")

    # Now safe to restore strict email uniqueness.
    op.drop_index("uq_users_tenant_id_lower_email_role", table_name="users")
    op.create_index(
        "uq_users_tenant_id_lower_email",
        "users",
        [sa.text("tenant_id"), sa.text("lower(email)")],
        unique=True,
    )

    # NOTE: Postgres cannot remove enum values cleanly without recreating
    # the type. The 'patient' enum value stays; no row carries it after
    # the column drop, so it is harmless.
