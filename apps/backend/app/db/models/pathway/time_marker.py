# Vertical day marker on the canvas (e.g. "Surgery + 30d"). Presentation
# only — does not influence routing.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayTimeMarker(TenantOwnedEntity):
    __tablename__ = "pathway_time_marker"
    __realtime_resource__: ClassVar[str | None] = None

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(sa.String(255), nullable=False)
