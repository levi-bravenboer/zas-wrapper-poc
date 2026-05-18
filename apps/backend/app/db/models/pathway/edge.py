# Connector between two blocks. One edge model handles forward, branch, and
# loopback uniformly. `source_branch_id` (optional) disambiguates which
# branch of a decision block the edge leaves from; D19 ensures it belongs to
# `source_block_id`. UNIQUE NULLS NOT DISTINCT (D20) blocks duplicate
# connectors at the DB layer; the builder UI also prevents duplicate drags.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayEdge(TenantOwnedEntity):
    __tablename__ = "pathway_edge"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "source_block_id",
            "target_block_id",
            "source_branch_id",
            name="uq_pathway_edge_source_target_branch",
            postgresql_nulls_not_distinct=True,
        ),
        # Edge timing union: at most one of the three discriminators may be
        # set. `immediate` is encoded as all-null. Mirrors the catalogue's
        # EDGE_TIMING_KINDS contract; service layer enforces the same rule so
        # violations surface as 422 not 23514.
        sa.CheckConstraint(
            "num_nonnulls(delay_value_id, time_marker_id, source_branch_id) <= 1",
            name="ck_pathway_edge_one_timing",
        ),
        # Marker timing is a triple: all three columns must be set together or
        # all null. Prevents partially-configured marker edges from sneaking
        # past the service layer.
        sa.CheckConstraint(
            "((time_marker_id IS NULL) = (offset_value_id IS NULL)) "
            "AND ((time_marker_id IS NULL) = (offset_direction_code IS NULL))",
            name="ck_pathway_edge_offset_pair",
        ),
    )

    pathway_version_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_version.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_block_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_block_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block_branch.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    delay_value_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
        nullable=True,
    )
    time_marker_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_time_marker.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    offset_value_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    offset_direction_code: Mapped[str | None] = mapped_column(
        sa.String(63),
        sa.ForeignKey(
            "pathway_edge_offset_direction.code",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
