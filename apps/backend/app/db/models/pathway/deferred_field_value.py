"""`PathwayDeferredFieldValue` — runtime values for `DeferredFieldSpec`.

One row per `(enrollment, block_template, attr)`. Carries the typed
value as JSONB (per the block subclass's `DeferredFieldSpec.kind`)
plus audit columns. Distinguished from
`pathway_block_deferred_field` (slot #1) — that row declares the
*spec*; this row holds the *value*.

The runtime gate (slot #3 §6.1) blocks an enrollment from leaving
`pending` until every required `DeferredFieldSpec` on every block
in the version has a value here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayDeferredFieldValue(TenantOwnedEntity):
    __tablename__ = "pathway_deferred_field_value"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "enrollment_id",
            "block_template_id",
            "attr",
            name="uq_pathway_deferred_field_value_enrollment_block_attr",
        ),
    )

    enrollment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_enrollment.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    block_template_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # The `DeferredFieldSpec.attr` this value answers — must match a
    # spec entry on the block subclass at validation time.
    attr: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    value_json: Mapped[Any] = mapped_column(JSONB, nullable=False)
    set_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
