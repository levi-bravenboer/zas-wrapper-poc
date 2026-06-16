"""`PathwayEnrollment` — one row per `(patient, pathway_version)` pair.

Chain slot #3 (`pathway-runtime-aggregate`) introduces the runtime
aggregate per the D5 hard split: template-side state stays in slot #1
/ slot #2 tables; runtime state lives here, in `BlockExecution`, and
in `DeferredFieldValue`.

`anchor_date` is the patient-chosen start point against which every
relative `TimingPolicy.offset_iso` is computed at enrollment time.
The runtime engine never re-derives `BlockExecution.scheduled_at`
from this column at evaluation time — once written, the runtime row
owns the schedule.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayEnrollment(TenantOwnedEntity):
    __tablename__ = "pathway_enrollment"
    __realtime_resource__: ClassVar[str | None] = "pathway_enrollment"
    __table_args__ = (
        sa.CheckConstraint(
            "state IN ('active', 'paused', 'completed', 'cancelled')",
            name="ck_pathway_enrollment_state",
        ),
        # `(patient_id, pathway_version_id)` uniqueness is enforced
        # by a partial unique index in alembic (live rows only) so
        # soft-deleted enrollments don't block re-enrolment.
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    pathway_version_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_version.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    anchor_date: Mapped[date] = mapped_column(sa.Date, nullable=False)
    state: Mapped[str] = mapped_column(
        sa.String(16),
        nullable=False,
        server_default=sa.text("'active'"),
    )
