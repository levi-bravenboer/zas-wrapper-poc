# Marks `field_path` (which must exist in the owning block's `config_schema`)
# as filled at enrollment instead of design-time (D18) — the row is the
# "fill later" marker, not the resolved value. Runtime resolution is parked
# together with the runtime timing kind (D17).

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayBlockDeferredField(TenantOwnedEntity):
    __tablename__ = "pathway_block_deferred_field"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "block_id",
            "field_path",
            name="uq_pathway_block_deferred_field_block_id_field_path",
        ),
    )

    block_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_path: Mapped[str] = mapped_column(sa.String(255), nullable=False)
