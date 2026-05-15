# Connector between two blocks. One edge model handles forward, branch, and
# loopback uniformly. `source_branch_id` (optional) disambiguates which
# branch of a decision block the edge leaves from; D19 ensures it belongs to
# `source_block_id`. UNIQUE NULLS NOT DISTINCT (D20) blocks duplicate
# connectors at the DB layer; the builder UI also prevents duplicate drags.

from __future__ import annotations
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayEdge(TenantOwnedEntity):
    __tablename__ = "pathway_edge"
    __table_args__ = (
        sa.UniqueConstraint(
            "source_block_id",
            "target_block_id",
            "source_branch_id",
            name="uq_pathway_edge_source_target_branch",
            postgresql_nulls_not_distinct=True,
        ),
    )

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
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
        sa.ForeignKey("pathway_branch.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    delay_value_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_timing_value.id", ondelete="RESTRICT"),
        nullable=True,
    )
