"""add_pathway_version_table

Revision ID: 761940d8999e
Revises: 6175e2c8ebf8
Create Date: 2026-05-16 18:02:29.221969

Two-level aggregate: `pathway` holds identity, `pathway_version` owns the
structural snapshot. Structural children (phase/lane/block/edge/time_marker/
timing_value) move from `pathway_id` to `pathway_version_id`. Any pre-existing
pathway gets one initial concept version backfilled and its children reparented.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "761940d8999e"
down_revision: str | None = "6175e2c8ebf8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CHILD_TABLES = (
    "pathway_phase",
    "pathway_lane",
    "pathway_block",
    "pathway_edge",
    "pathway_time_marker",
    "pathway_timing_value",
)


def upgrade() -> None:
    op.create_table(
        "pathway_version",
        sa.Column("pathway_id", sa.UUID(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("derived_from_version_id", sa.UUID(), nullable=True),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", sa.UUID(), nullable=True),
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
        sa.CheckConstraint(
            "(status = 'published') = (published_at IS NOT NULL)",
            name="ck_pathway_version_published_at_matches_status",
        ),
        sa.CheckConstraint(
            "(status = 'published') = (published_by IS NOT NULL)",
            name="ck_pathway_version_published_by_matches_status",
        ),
        sa.CheckConstraint(
            "kind IN ('initial', 'fork-from-publish', 'restore-from-version')",
            name="ck_pathway_version_kind",
        ),
        sa.CheckConstraint(
            "status IN ('concept', 'published', 'archived')",
            name="ck_pathway_version_status",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["derived_from_version_id"], ["pathway_version.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["pathway_id"], ["pathway.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["published_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "pathway_id", "version_no", name="uq_pathway_version_pathway_id_version_no"
        ),
    )
    op.create_index(
        op.f("ix_pathway_version_pathway_id"), "pathway_version", ["pathway_id"], unique=False
    )
    op.create_index(
        "ix_pathway_version_pathway_status_published",
        "pathway_version",
        ["pathway_id", "status", sa.literal_column("published_at DESC")],
        unique=False,
    )
    op.create_index(
        op.f("ix_pathway_version_tenant_id"), "pathway_version", ["tenant_id"], unique=False
    )
    op.create_index(
        "uq_pathway_version_one_concept_per_pathway",
        "pathway_version",
        ["pathway_id"],
        unique=True,
        postgresql_where=sa.text("status = 'concept' AND deleted_at IS NULL"),
    )

    # Backfill: one initial concept pathway_version per existing pathway. Uses
    # pathway.id as the version id so child reparenting can map without joins.
    op.execute(
        """
        INSERT INTO pathway_version (
            id, pathway_id, version_no, status, kind,
            tenant_id, created_by, updated_by,
            created_at, updated_at
        )
        SELECT
            p.id, p.id, 1, 'concept', 'initial',
            p.tenant_id, p.created_by, p.updated_by,
            p.created_at, p.updated_at
        FROM pathway p
        WHERE p.deleted_at IS NULL
        """
    )

    # Reparent each child table from pathway_id to pathway_version_id (= pathway.id from backfill).
    for child in CHILD_TABLES:
        op.add_column(child, sa.Column("pathway_version_id", sa.UUID(), nullable=True))
        op.execute(f"UPDATE {child} SET pathway_version_id = pathway_id")
        op.alter_column(child, "pathway_version_id", nullable=False)

    op.drop_index(op.f("ix_pathway_block_pathway_id"), table_name="pathway_block")
    op.create_index(
        op.f("ix_pathway_block_pathway_version_id"),
        "pathway_block",
        ["pathway_version_id"],
        unique=False,
    )
    op.drop_constraint(
        op.f("pathway_block_pathway_id_fkey"), "pathway_block", type_="foreignkey"
    )
    op.create_foreign_key(
        None,
        "pathway_block",
        "pathway_version",
        ["pathway_version_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("pathway_block", "pathway_id")

    op.drop_index(op.f("ix_pathway_edge_pathway_id"), table_name="pathway_edge")
    op.create_index(
        op.f("ix_pathway_edge_pathway_version_id"),
        "pathway_edge",
        ["pathway_version_id"],
        unique=False,
    )
    op.drop_constraint(op.f("pathway_edge_pathway_id_fkey"), "pathway_edge", type_="foreignkey")
    op.create_foreign_key(
        None,
        "pathway_edge",
        "pathway_version",
        ["pathway_version_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("pathway_edge", "pathway_id")

    op.drop_index(op.f("ix_pathway_lane_pathway_id"), table_name="pathway_lane")
    op.drop_constraint(op.f("uq_pathway_lane_pathway_id_ord"), "pathway_lane", type_="unique")
    op.create_index(
        op.f("ix_pathway_lane_pathway_version_id"),
        "pathway_lane",
        ["pathway_version_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_pathway_lane_pathway_version_id_ord", "pathway_lane", ["pathway_version_id", "ord"]
    )
    op.drop_constraint(op.f("pathway_lane_pathway_id_fkey"), "pathway_lane", type_="foreignkey")
    op.create_foreign_key(
        None,
        "pathway_lane",
        "pathway_version",
        ["pathway_version_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("pathway_lane", "pathway_id")

    op.drop_index(op.f("ix_pathway_phase_pathway_id"), table_name="pathway_phase")
    op.drop_constraint(op.f("uq_pathway_phase_pathway_id_ord"), "pathway_phase", type_="unique")
    op.create_index(
        op.f("ix_pathway_phase_pathway_version_id"),
        "pathway_phase",
        ["pathway_version_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_pathway_phase_pathway_version_id_ord", "pathway_phase", ["pathway_version_id", "ord"]
    )
    op.drop_constraint(op.f("pathway_phase_pathway_id_fkey"), "pathway_phase", type_="foreignkey")
    op.create_foreign_key(
        None,
        "pathway_phase",
        "pathway_version",
        ["pathway_version_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("pathway_phase", "pathway_id")

    op.drop_index(op.f("ix_pathway_time_marker_pathway_id"), table_name="pathway_time_marker")
    op.create_index(
        op.f("ix_pathway_time_marker_pathway_version_id"),
        "pathway_time_marker",
        ["pathway_version_id"],
        unique=False,
    )
    op.drop_constraint(
        op.f("pathway_time_marker_pathway_id_fkey"), "pathway_time_marker", type_="foreignkey"
    )
    op.create_foreign_key(
        None,
        "pathway_time_marker",
        "pathway_version",
        ["pathway_version_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("pathway_time_marker", "pathway_id")

    op.drop_index(op.f("ix_pathway_timing_value_pathway_id"), table_name="pathway_timing_value")
    op.create_index(
        op.f("ix_pathway_timing_value_pathway_version_id"),
        "pathway_timing_value",
        ["pathway_version_id"],
        unique=False,
    )
    op.drop_constraint(
        op.f("pathway_timing_value_pathway_id_fkey"), "pathway_timing_value", type_="foreignkey"
    )
    op.create_foreign_key(
        None,
        "pathway_timing_value",
        "pathway_version",
        ["pathway_version_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("pathway_timing_value", "pathway_id")


def downgrade() -> None:
    op.add_column(
        "pathway_timing_value",
        sa.Column("pathway_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(None, "pathway_timing_value", type_="foreignkey")
    op.create_foreign_key(
        op.f("pathway_timing_value_pathway_id_fkey"),
        "pathway_timing_value",
        "pathway",
        ["pathway_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(
        op.f("ix_pathway_timing_value_pathway_version_id"), table_name="pathway_timing_value"
    )
    op.create_index(
        op.f("ix_pathway_timing_value_pathway_id"),
        "pathway_timing_value",
        ["pathway_id"],
        unique=False,
    )
    op.drop_column("pathway_timing_value", "pathway_version_id")

    op.add_column(
        "pathway_time_marker",
        sa.Column("pathway_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(None, "pathway_time_marker", type_="foreignkey")
    op.create_foreign_key(
        op.f("pathway_time_marker_pathway_id_fkey"),
        "pathway_time_marker",
        "pathway",
        ["pathway_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(
        op.f("ix_pathway_time_marker_pathway_version_id"), table_name="pathway_time_marker"
    )
    op.create_index(
        op.f("ix_pathway_time_marker_pathway_id"),
        "pathway_time_marker",
        ["pathway_id"],
        unique=False,
    )
    op.drop_column("pathway_time_marker", "pathway_version_id")

    op.add_column(
        "pathway_phase",
        sa.Column("pathway_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(None, "pathway_phase", type_="foreignkey")
    op.create_foreign_key(
        op.f("pathway_phase_pathway_id_fkey"),
        "pathway_phase",
        "pathway",
        ["pathway_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("uq_pathway_phase_pathway_version_id_ord", "pathway_phase", type_="unique")
    op.drop_index(op.f("ix_pathway_phase_pathway_version_id"), table_name="pathway_phase")
    op.create_unique_constraint(
        op.f("uq_pathway_phase_pathway_id_ord"),
        "pathway_phase",
        ["pathway_id", "ord"],
        postgresql_nulls_not_distinct=False,
    )
    op.create_index(
        op.f("ix_pathway_phase_pathway_id"), "pathway_phase", ["pathway_id"], unique=False
    )
    op.drop_column("pathway_phase", "pathway_version_id")

    op.add_column(
        "pathway_lane",
        sa.Column("pathway_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(None, "pathway_lane", type_="foreignkey")
    op.create_foreign_key(
        op.f("pathway_lane_pathway_id_fkey"),
        "pathway_lane",
        "pathway",
        ["pathway_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("uq_pathway_lane_pathway_version_id_ord", "pathway_lane", type_="unique")
    op.drop_index(op.f("ix_pathway_lane_pathway_version_id"), table_name="pathway_lane")
    op.create_unique_constraint(
        op.f("uq_pathway_lane_pathway_id_ord"),
        "pathway_lane",
        ["pathway_id", "ord"],
        postgresql_nulls_not_distinct=False,
    )
    op.create_index(
        op.f("ix_pathway_lane_pathway_id"), "pathway_lane", ["pathway_id"], unique=False
    )
    op.drop_column("pathway_lane", "pathway_version_id")

    op.add_column(
        "pathway_edge",
        sa.Column("pathway_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(None, "pathway_edge", type_="foreignkey")
    op.create_foreign_key(
        op.f("pathway_edge_pathway_id_fkey"),
        "pathway_edge",
        "pathway",
        ["pathway_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_pathway_edge_pathway_version_id"), table_name="pathway_edge")
    op.create_index(
        op.f("ix_pathway_edge_pathway_id"), "pathway_edge", ["pathway_id"], unique=False
    )
    op.drop_column("pathway_edge", "pathway_version_id")

    op.add_column(
        "pathway_block",
        sa.Column("pathway_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(None, "pathway_block", type_="foreignkey")
    op.create_foreign_key(
        op.f("pathway_block_pathway_id_fkey"),
        "pathway_block",
        "pathway",
        ["pathway_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_pathway_block_pathway_version_id"), table_name="pathway_block")
    op.create_index(
        op.f("ix_pathway_block_pathway_id"), "pathway_block", ["pathway_id"], unique=False
    )
    op.drop_column("pathway_block", "pathway_version_id")

    op.drop_index(
        "uq_pathway_version_one_concept_per_pathway",
        table_name="pathway_version",
        postgresql_where=sa.text("status = 'concept' AND deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_pathway_version_tenant_id"), table_name="pathway_version")
    op.drop_index("ix_pathway_version_pathway_status_published", table_name="pathway_version")
    op.drop_index(op.f("ix_pathway_version_pathway_id"), table_name="pathway_version")
    op.drop_table("pathway_version")
