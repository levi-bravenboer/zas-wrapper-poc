"""add external idp fields to users

Revision ID: a7c1d9e4b210
Revises: f2e49e3d3c14
Create Date: 2026-05-15 10:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c1d9e4b210"
down_revision: str | None = "f2e49e3d3c14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.add_column("users", sa.Column("external_idp", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("external_subject", sa.String(length=255), nullable=True))
    op.create_index(
        "uq_users_tenant_external_subject",
        "users",
        ["tenant_id", "external_idp", "external_subject"],
        unique=True,
        postgresql_where=sa.text("external_subject IS NOT NULL"),
    )
    op.create_check_constraint(
        "ck_users_credential_present",
        "users",
        "password_hash IS NOT NULL OR external_subject IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_credential_present", "users", type_="check")
    op.drop_index("uq_users_tenant_external_subject", table_name="users")
    op.drop_column("users", "external_subject")
    op.drop_column("users", "external_idp")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
