# FHIR R4 `CareTeam` (subset). One row per care team — a patient may have
# multiple concurrent teams (multi-condition care). `period_start` / `period_end`
# bound the team's active window; `status` carries the FHIR-aligned narrowed
# code set (`active|inactive`). `category` reserves the FHIR codeable-concept
# slot without persisting structured codes yet (free string in PoC).
#
# Participants are persisted in `care_team_participants`. The relationship is
# `selectin` so list endpoints fetch all rows in a second query, matching the
# Patient.identifiers pattern.

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.care_team import CareTeamStatus
from app.db.base import TenantOwnedEntity

if TYPE_CHECKING:
    from app.db.models.care_team.care_team_participant import CareTeamParticipant


class CareTeam(TenantOwnedEntity):
    __tablename__ = "care_teams"
    __realtime_resource__: ClassVar[str | None] = "care_teams"

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    status: Mapped[CareTeamStatus] = mapped_column(
        sa.Enum(
            CareTeamStatus,
            name="care_team_status",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
        server_default=sa.text("'active'"),
    )
    period_start: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    period_end: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    category: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    participants: Mapped[list[CareTeamParticipant]] = relationship(
        "CareTeamParticipant",
        back_populates="care_team",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
