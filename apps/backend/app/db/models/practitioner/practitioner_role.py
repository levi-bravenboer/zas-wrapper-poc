# FHIR R4 `PractitionerRole`. M:N relationship between `Practitioner` and
# `Organisation`, period-bounded. Each row represents "this practitioner is
# affiliated with this organisation under this role, from period_start to
# period_end (NULL = open)".
#
# Partial unique indexes guarantee:
# - one open row per (practitioner, organisation) — close-and-reopen pattern
# - one open primary row per practitioner — UI must demote existing primary
#   before promoting another.
#
# Closed rows (period_end IS NOT NULL) MAY overlap freely and accumulate as
# history. The list endpoint exposes both open and closed rows; the
# `is_open` filter selects between them.

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.db.base import TenantOwnedEntity

if TYPE_CHECKING:
    from app.db.models.practitioner.practitioner import Practitioner


class PractitionerRole(TenantOwnedEntity):
    __tablename__ = "practitioner_roles"
    __realtime_resource__: ClassVar[str | None] = "practitioner_roles"
    __table_args__ = (
        sa.Index(
            "uq_practitioner_roles_open_affiliation",
            "practitioner_id",
            "organisation_id",
            unique=True,
            postgresql_where=sa.text("period_end IS NULL"),
        ),
        sa.Index(
            "uq_practitioner_roles_open_primary",
            "practitioner_id",
            unique=True,
            postgresql_where=sa.text("is_primary AND period_end IS NULL"),
        ),
        sa.Index(
            "ix_practitioner_roles_practitioner_open",
            "practitioner_id",
            postgresql_where=sa.text("period_end IS NULL"),
        ),
        sa.Index(
            "ix_practitioner_roles_organisation_open",
            "organisation_id",
            postgresql_where=sa.text("period_end IS NULL"),
        ),
    )

    practitioner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("practitioners.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    organisation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("organisations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    code: Mapped[PractitionerRoleCode] = mapped_column(
        sa.Enum(
            PractitionerRoleCode,
            name="practitioner_role_code",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )
    specialty: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
    period_start: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    period_end: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)

    practitioner: Mapped[Practitioner] = relationship(
        "Practitioner",
        back_populates="roles",
        lazy="selectin",
    )
