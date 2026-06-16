# Per-user read-state for the `/tasks` inbox. A row means "this user has
# opened this task"; absence means unopened. Keyed by the same
# `(source, source_id)` addressing the aggregator uses, so read-state is
# decoupled from any one task source (v1 `appointment`, future sources reuse
# this table unchanged).
#
# `user_id` is the caregiver the read-state belongs to. Tenant-owned + audited
# by construction: `created_by` (the opener) equals `user_id` for self-opens.
# The partial unique index enforces at most one active row per
# `(user_id, source, source_id)`.

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class TaskReadState(TenantOwnedEntity):
    __tablename__ = "task_read_state"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.Index(
            "uq_task_read_state_user_source_open",
            "user_id",
            "source",
            "source_id",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index(
            "ix_task_read_state_user_source",
            "user_id",
            "source",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    source_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    opened_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
