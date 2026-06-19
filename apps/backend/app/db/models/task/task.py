# A first-class work item assigned to one user (caregiver) within one tenant.
# Replaces the removed appointment-as-task projection: a task is now a stored
# domain entity, not a view over appointments. `source_ref` is an opaque,
# FK-less origin pointer (e.g. "appointment:<uuid>") so a task may originate
# from any domain or none, keeping tasks decoupled from appointments.

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.task import TaskStatus
from app.db.base import TenantOwnedEntity


class Task(TenantOwnedEntity):
    __tablename__ = "tasks"
    __realtime_resource__: ClassVar[str | None] = "tasks"
    __audited__: ClassVar[bool] = True
    __table_args__ = (
        sa.Index(
            "ix_tasks_assignee_status_open",
            "tenant_id",
            "assignee_user_id",
            "status",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )

    assignee_user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        sa.Enum(
            TaskStatus,
            name="task_status",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
        server_default=sa.text("'open'"),
    )
    due_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    patient_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    source_ref: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
