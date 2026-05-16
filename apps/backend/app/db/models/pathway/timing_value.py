# `pathway_timing_value` is shared by `pathway_block.duration_value_id`,
# `pathway_edge.delay_value_id`, and `pathway_time_marker.value_id`.
# `kind` is a text discriminator (D12) — runtime kind parked in MVP delta (D17).
# CHECK enforces exactly the column-set appropriate for the chosen kind.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity

TIMING_KINDS = ("fixed", "enrollment")


class PathwayTimingValue(TenantOwnedEntity):
    __tablename__ = "pathway_timing_value"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.CheckConstraint(f"kind IN {TIMING_KINDS}", name="ck_pathway_timing_value_kind"),
        sa.CheckConstraint(
            "("
            "(kind = 'fixed'"
            " AND fixed_days IS NOT NULL"
            " AND enrollment_default_days IS NULL"
            " AND enrollment_min_days IS NULL"
            " AND enrollment_max_days IS NULL)"
            " OR "
            "(kind = 'enrollment'"
            " AND fixed_days IS NULL"
            " AND enrollment_default_days IS NOT NULL)"
            ")",
            name="ck_pathway_timing_value_columns_per_kind",
        ),
        sa.CheckConstraint(
            "(enrollment_min_days IS NULL OR enrollment_max_days IS NULL "
            "OR enrollment_min_days <= enrollment_max_days)",
            name="ck_pathway_timing_value_min_le_max",
        ),
    )

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    fixed_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    enrollment_default_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    enrollment_min_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    enrollment_max_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
