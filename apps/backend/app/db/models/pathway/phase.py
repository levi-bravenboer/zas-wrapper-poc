# Decorative chapter grouping per D11 — no duration, no anchor in PoC.
# `template_id` is a soft pointer to the code-side phase-template registry
# (D14); no FK constraint so renaming/removing a template never breaks
# pathways already using it.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayPhase(TenantOwnedEntity):
    __tablename__ = "pathway_phase"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "pathway_version_id", "ord", name="uq_pathway_phase_pathway_version_id_ord"
        ),
    )

    pathway_version_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_version.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[str | None] = mapped_column(sa.String(63), nullable=True)
    label: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    ord: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    width_px: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("380"))
