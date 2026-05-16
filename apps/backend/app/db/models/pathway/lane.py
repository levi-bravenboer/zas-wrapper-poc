# Per-pathway lane instance (D9 + D10). FKs `pathway_lane_kind` for the
# system-wide kind catalogue. Default lanes are materialized on first block
# placement of that kind; custom lanes are added by the author with
# `is_default=false`.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayLane(TenantOwnedEntity):
    __tablename__ = "pathway_lane"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint("pathway_id", "ord", name="uq_pathway_lane_pathway_id_ord"),
    )

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pathway_lane_kind_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_lane_kind.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    ord: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    is_default: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.false())
