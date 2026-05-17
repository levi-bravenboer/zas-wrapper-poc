"""add organisations sort_index

Revision ID: a1f5b9c2d4e7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-17 15:00:00

Adds a stable per-sibling ordering column `sort_index` to `organisations`,
plus a composite `(parent_organisation_id, sort_index)` index. Existing rows
are backfilled deterministically by `name` (ties broken by `id`) so the
post-migration ordering reproduces the previous alphabetical render. See
`openspec/changes/organisations-tree-dnd-editor/`.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1f5b9c2d4e7"
down_revision: str | None = "f1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organisations",
        sa.Column(
            "sort_index",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.execute(
        """
        UPDATE organisations
        SET sort_index = sub.rn - 1
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY parent_organisation_id
                       ORDER BY name, id
                   ) AS rn
            FROM organisations
        ) sub
        WHERE organisations.id = sub.id;
        """
    )
    op.create_index(
        "ix_organisations_parent_sort",
        "organisations",
        ["parent_organisation_id", "sort_index"],
    )


def downgrade() -> None:
    op.drop_index("ix_organisations_parent_sort", table_name="organisations")
    op.drop_column("organisations", "sort_index")
