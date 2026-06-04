# External collaboration model (REQ-FUN-1/42).
#
# `ExternalAccessProfile` — per professional type, which verbs MAY be granted
# (REQ-FUN-42 "configuration of permitted activities per type"). Professional
# types reuse `PractitionerRoleCode` (FHIR-aligned).
#
# `ExternalGrant` — a concrete consent-backed grant of access to one patient
# for one external user. Verb tuples are derived as
# profile.verbs ∩ grant-period-open ∩ consent-active
# (see app/services/access/sync/derive.py). Externals NEVER receive
# `view_shielded` regardless of verbs.

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.db.base import TenantOwnedEntity

_PROFESSIONAL_TYPE = sa.Enum(
    PractitionerRoleCode,
    name="practitioner_role_code",
    native_enum=True,
    create_constraint=True,
    values_callable=lambda enum_cls: [m.value for m in enum_cls],
)


class ExternalAccessProfile(TenantOwnedEntity):
    __tablename__ = "external_access_profiles"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "tenant_id", "professional_type", name="uq_external_access_profiles_tenant_type"
        ),
    )

    professional_type: Mapped[PractitionerRoleCode] = mapped_column(
        _PROFESSIONAL_TYPE, nullable=False
    )
    allow_read: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("true")
    )
    allow_write: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )
    allow_record: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )
    allow_message: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )


class ExternalGrant(TenantOwnedEntity):
    __tablename__ = "external_grants"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.Index(
            "ix_external_grants_patient_open",
            "patient_id",
            postgresql_where=sa.text("period_end IS NULL"),
        ),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    professional_type: Mapped[PractitionerRoleCode] = mapped_column(
        _PROFESSIONAL_TYPE, nullable=False
    )
    consent_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("consents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    period_start: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    period_end: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
