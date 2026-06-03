# Node on the canvas. `type` validated app-side against the code-owned
# block-type catalogue (D2). `config` is the ONE purposeful jsonb in the
# pathway domain (Naming Exception 1); Pydantic validates it against the
# catalogue's per-type `config_schema` on save. `x` / `y` are canvas
# coordinates persisted as ints.

from __future__ import annotations

from typing import Any, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayBlock(TenantOwnedEntity):
    __tablename__ = "pathway_block"
    __realtime_resource__: ClassVar[str | None] = None

    pathway_version_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_version.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phase_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_phase.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    lane_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_lane.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(sa.String(63), nullable=False)
    label: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    duration_value_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
        nullable=True,
    )
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
    # Frozen child reference produced at publish time for blocks whose body
    # is a link to a moving target (today: `pathway_link`). NULL on concept
    # rows, populated by the nested-pathway snapshot resolver when the parent
    # version flips to `published`. Shape:
    #   {"target_pathway_id": uuid, "resolved_version_id": uuid,
    #    "tracking": "specific" | "latest_published"}
    snapshot_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    x: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    y: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
