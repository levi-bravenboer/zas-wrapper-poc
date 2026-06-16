"""sync pathway runtime audit/tenant fks and kind nullability

Revision ID: 6ffb3cb72c4c
Revises: f442e2bccbb7
Create Date: 2026-06-16 09:56:19.755971

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6ffb3cb72c4c"
down_revision: str | None = "f442e2bccbb7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_EXECUTION_FKS = (
    ("fk_pathway_block_execution_created_by_users", "created_by", "users"),
    ("fk_pathway_block_execution_updated_by_users", "updated_by", "users"),
    ("fk_pathway_block_execution_deleted_by_users", "deleted_by", "users"),
    ("fk_pathway_block_execution_tenant_id_tenants", "tenant_id", "tenants"),
)
_DEFERRED_FKS = (
    ("fk_pathway_deferred_field_value_created_by_users", "created_by", "users"),
    ("fk_pathway_deferred_field_value_updated_by_users", "updated_by", "users"),
    ("fk_pathway_deferred_field_value_deleted_by_users", "deleted_by", "users"),
    ("fk_pathway_deferred_field_value_tenant_id_tenants", "tenant_id", "tenants"),
)


def upgrade() -> None:
    op.alter_column(
        "pathway_block",
        "kind",
        existing_type=sa.VARCHAR(length=32),
        nullable=True,
    )
    for name, col, ref in _EXECUTION_FKS:
        op.create_foreign_key(
            name, "pathway_block_execution", ref, [col], ["id"], ondelete="RESTRICT"
        )
    for name, col, ref in _DEFERRED_FKS:
        op.create_foreign_key(
            name, "pathway_deferred_field_value", ref, [col], ["id"], ondelete="RESTRICT"
        )


def downgrade() -> None:
    for name, _col, _ref in _DEFERRED_FKS:
        op.drop_constraint(name, "pathway_deferred_field_value", type_="foreignkey")
    for name, _col, _ref in _EXECUTION_FKS:
        op.drop_constraint(name, "pathway_block_execution", type_="foreignkey")
    op.alter_column(
        "pathway_block",
        "kind",
        existing_type=sa.VARCHAR(length=32),
        nullable=False,
    )
