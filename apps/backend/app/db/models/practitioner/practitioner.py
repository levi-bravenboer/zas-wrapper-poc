# FHIR R4 `Practitioner` (subset). One row per clinical identity. Splits the
# clinical name + qualification metadata away from `User` (which now carries
# only authentication identity + app role). The 1:1 link is enforced via a
# unique FK on `user_id` — a `User` with `role=caregiver` MUST have exactly
# one `Practitioner` row in the same tenant; non-caregiver users have none.
#
# Affiliations live in `practitioner_roles` (M:N with `organisations`).
# Cross-tenant Practitioners are explicitly out of scope for the PoC; see
# `BL-063`.

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantOwnedEntity

if TYPE_CHECKING:
    from app.db.models.practitioner.practitioner_role import PractitionerRole
    from app.db.models.user.user import User


class Practitioner(TenantOwnedEntity):
    __tablename__ = "practitioners"
    __realtime_resource__: ClassVar[str | None] = "practitioners"
    __table_args__ = (
        sa.Index(
            "uq_practitioners_user_id",
            "user_id",
            unique=True,
        ),
        sa.Index("ix_practitioners_tenant_id_family_name", "tenant_id", "family_name"),
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    family_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    given_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    qualification: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    roles: Mapped[list[PractitionerRole]] = relationship(
        "PractitionerRole",
        back_populates="practitioner",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="(PractitionerRole.is_primary.desc(), PractitionerRole.period_start.desc())",
    )
    user: Mapped[User] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
