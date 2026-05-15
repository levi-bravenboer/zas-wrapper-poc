"""add users audit fks

Revision ID: f2e49e3d3c14
Revises: 39248136adbb
Create Date: 2026-05-15 09:40:38.051265

"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "f2e49e3d3c14"
down_revision: str | None = "39248136adbb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_users_created_by_users",
        "users",
        "users",
        ["created_by"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_users_updated_by_users",
        "users",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_users_deleted_by_users",
        "users",
        "users",
        ["deleted_by"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_deleted_by_users", "users", type_="foreignkey")
    op.drop_constraint("fk_users_updated_by_users", "users", type_="foreignkey")
    op.drop_constraint("fk_users_created_by_users", "users", type_="foreignkey")
