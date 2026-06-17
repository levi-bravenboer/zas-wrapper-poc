"""`PathwayEnrollmentParticipant` — a Practitioner bound to a block at enroll.

A materialising block (`appointment`/`treatment`/`mdo`/`task`) declares a
required performer as a role + specialty (`ParticipantSpec`); the enrolling
caregiver resolves it to a concrete user. The binding is read at
materialisation time so the created Appointment lists the chosen
Practitioner as its LEAD participant (pathway-runtime §2.6/§5.4).
"""

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayEnrollmentParticipant(TenantOwnedEntity):
    __tablename__ = "pathway_enrollment_participant"
    # Enroll-time binding; not streamed to clients.
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.Index(
            "uq_pathway_enrollment_participant_live",
            "enrollment_id",
            "block_template_id",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
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
    )
    # The resolved Practitioner (a user). Bare UUID, no FK — mirrors the other
    # runtime-projection links and avoids a cross-domain RESTRICT.
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    role: Mapped[str] = mapped_column(sa.String(64), nullable=False)
