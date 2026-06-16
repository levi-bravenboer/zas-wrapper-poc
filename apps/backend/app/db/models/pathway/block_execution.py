"""`PathwayBlockExecution` — one row per `(enrollment, block_template)`.

Carries the runtime schedule + state-machine cursor for a single
block instance in a single enrollment. See `pathway-runtime-aggregate`
§1.2.

The state machine: `pending → eligible → active → completed`, with
`pending | eligible → skipped` and `active → failed` branches.
Transitions are owned by the runtime engine
(`app/services/pathway/runtime/engine.py`); the column itself only
stores the current cursor.

`result_json` carries the typed payload validated against the block
subclass's `RESULT_TYPE`. Schema enforcement is application-layer —
the column is intentionally JSONB so the engine can extend per-kind
shapes without a migration.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayBlockExecution(TenantOwnedEntity):
    __tablename__ = "pathway_block_execution"
    __realtime_resource__: ClassVar[str | None] = "pathway_block_execution"
    __table_args__ = (
        sa.CheckConstraint(
            "state IN ('pending', 'eligible', 'active', 'completed', 'skipped', 'failed')",
            name="ck_pathway_block_execution_state",
        ),
        # Uniqueness is enforced by a partial index in alembic
        # (`uq_pathway_block_execution_enrollment_template_live`)
        # so a soft-deleted run doesn't block rebuilding the
        # runtime aggregate.
        sa.Index(
            "ix_pathway_block_execution_enrollment_state",
            "enrollment_id",
            "state",
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
    scheduled_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    state: Mapped[str] = mapped_column(
        sa.String(16),
        nullable=False,
        server_default=sa.text("'pending'"),
    )
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # DecisionBlock-only: which `outputs[*]` key fired at completion.
    # Populated by the engine; reused by the `decision_output`
    # predicate evaluator without re-parsing `result_json`.
    decision_output: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
