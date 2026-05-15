# FHIR R4 `CareTeam.participant`. One row per practitioner-on-team-during-period.
#
# Not an `AuditableEntity`: participant rows carry their own
# `assigned_by` / `unassigned_by` columns that mirror the FHIR semantics, and
# the audit hook's `created_by` / `updated_by` columns would duplicate the
# `assigned_by` field. We inherit `Entity` directly (id + timestamps + soft
# delete) and persist `tenant_id` denormalised so visibility queries do not
# need to join `care_teams`.
#
# History semantics: changing a participant's `role_in_care` closes the
# current open row (`period_end = now()`, `unassigned_by`) and inserts a new
# open row. Same `(care_team_id, user_id)` MAY repeat across non-overlapping
# periods (leave-and-rejoin). A partial unique index on
# `(care_team_id, user_id) WHERE period_end IS NULL` prevents two concurrent
# open rows for the same practitioner on the same team — see migration.

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.care_team import RoleInCare
from app.db.base import Entity

if TYPE_CHECKING:
    from app.db.models.care_team.care_team import CareTeam


class CareTeamParticipant(Entity):
    __tablename__ = "care_team_participants"
    __realtime_resource__: ClassVar[str | None] = "care_team_participants"
    __table_args__ = (
        sa.Index(
            "uq_care_team_participants_open_membership",
            "care_team_id",
            "user_id",
            unique=True,
            postgresql_where=sa.text("period_end IS NULL"),
        ),
        sa.Index(
            "ix_care_team_participants_user_open",
            "user_id",
            postgresql_where=sa.text("period_end IS NULL"),
        ),
        sa.Index(
            "ix_care_team_participants_team_open",
            "care_team_id",
            postgresql_where=sa.text("period_end IS NULL"),
        ),
    )

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    care_team_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("care_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    role_in_care: Mapped[RoleInCare] = mapped_column(
        sa.Enum(
            RoleInCare,
            name="role_in_care",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )
    period_start: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    period_end: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    on_behalf_of_organisation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("organisations.id", ondelete="RESTRICT"),
        nullable=True,
    )
    assigned_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    unassigned_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    care_team: Mapped[CareTeam] = relationship("CareTeam", back_populates="participants")
