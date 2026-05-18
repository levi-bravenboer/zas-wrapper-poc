"""pathway block redesign and edge timing

Revision ID: 9a1c4f2d7e10
Revises: 761940d8999e
Create Date: 2026-05-17 15:30:00.000000

Block redesign: drop `timer`, rename `email` → `message`.
Edge timing: marker-anchored edges via three new columns on `pathway_edge`
(`time_marker_id`, `offset_value_id`, `offset_direction_code`) plus a new
`pathway_edge_offset_direction` lookup table seeded with `before`/`after`.

CHECK constraints enforce the edge timing union (at most one of the three
discriminators set) and the marker triple (all three offset columns null or
all three set together).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "9a1c4f2d7e10"
down_revision: str | Sequence[str] | None = "761940d8999e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Lookup table for edge offset directions.
    op.create_table(
        "pathway_edge_offset_direction",
        sa.Column("code", sa.String(length=63), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("ord", sa.SmallInteger(), nullable=False),
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
            "code ~ '^[a-z][a-z0-9-]{0,62}$'",
            name="ck_pathway_edge_offset_direction_code_format",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO pathway_edge_offset_direction (id, code, label, ord)
            VALUES
                (gen_random_uuid(), 'before', 'Voor', 10),
                (gen_random_uuid(), 'after', 'Na', 20)
            """
        )
    )

    # 2. Data migration on existing pathway_block rows before column changes.
    op.execute(sa.text("UPDATE pathway_block SET type = 'message' WHERE type = 'email'"))
    op.execute(sa.text("DELETE FROM pathway_block WHERE type = 'timer'"))

    # 3. New columns on pathway_edge.
    op.add_column(
        "pathway_edge",
        sa.Column("time_marker_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "pathway_edge",
        sa.Column("offset_value_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "pathway_edge",
        sa.Column("offset_direction_code", sa.String(length=63), nullable=True),
    )

    op.create_index(
        op.f("ix_pathway_edge_time_marker_id"),
        "pathway_edge",
        ["time_marker_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pathway_edge_offset_value_id"),
        "pathway_edge",
        ["offset_value_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pathway_edge_offset_direction_code"),
        "pathway_edge",
        ["offset_direction_code"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_pathway_edge_time_marker_id",
        "pathway_edge",
        "pathway_time_marker",
        ["time_marker_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_pathway_edge_offset_value_id",
        "pathway_edge",
        "pathway_timing_value",
        ["offset_value_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_pathway_edge_offset_direction_code",
        "pathway_edge",
        "pathway_edge_offset_direction",
        ["offset_direction_code"],
        ["code"],
        ondelete="RESTRICT",
    )

    # 4. CHECK constraints mirroring the ORM source of truth.
    op.create_check_constraint(
        "ck_pathway_edge_one_timing",
        "pathway_edge",
        "num_nonnulls(delay_value_id, time_marker_id, source_branch_id) <= 1",
    )
    op.create_check_constraint(
        "ck_pathway_edge_offset_pair",
        "pathway_edge",
        "((time_marker_id IS NULL) = (offset_value_id IS NULL)) "
        "AND ((time_marker_id IS NULL) = (offset_direction_code IS NULL))",
    )


def downgrade() -> None:
    # Downgrade reverses the schema changes and the `email` → `message` rename.
    # Deleted `timer` rows are not restored — there is no source of truth for
    # them after the upgrade.
    op.drop_constraint(
        "ck_pathway_edge_offset_pair",
        "pathway_edge",
        type_="check",
    )
    op.drop_constraint(
        "ck_pathway_edge_one_timing",
        "pathway_edge",
        type_="check",
    )

    op.drop_constraint(
        "fk_pathway_edge_offset_direction_code",
        "pathway_edge",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_pathway_edge_offset_value_id",
        "pathway_edge",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_pathway_edge_time_marker_id",
        "pathway_edge",
        type_="foreignkey",
    )

    op.drop_index(
        op.f("ix_pathway_edge_offset_direction_code"),
        table_name="pathway_edge",
    )
    op.drop_index(
        op.f("ix_pathway_edge_offset_value_id"),
        table_name="pathway_edge",
    )
    op.drop_index(
        op.f("ix_pathway_edge_time_marker_id"),
        table_name="pathway_edge",
    )

    op.drop_column("pathway_edge", "offset_direction_code")
    op.drop_column("pathway_edge", "offset_value_id")
    op.drop_column("pathway_edge", "time_marker_id")

    op.execute(sa.text("UPDATE pathway_block SET type = 'email' WHERE type = 'message'"))

    op.drop_table("pathway_edge_offset_direction")
