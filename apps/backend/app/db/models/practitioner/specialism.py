# Specialism master data + the PractitionerRole link (FHIR R4
# `PractitionerRole.specialty`, 0..*). REQ-FUN-26/28: specialisms arrive from
# ZAS master data at MVP; PoC seeds them locally. A role MAY carry multiple
# specialisms (surgeon + orthopedist on one affiliation), hence the M:N link
# instead of the legacy free-text `practitioner_roles.specialty` column
# (backfilled by the access-entitlements migration, no longer consulted for
# authorization).
#
# Authorization: `Specialism#practitioner` tuples are derived from open roles
# joined through this link (see app/services/access/sync/derive.py).

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class Specialism(TenantOwnedEntity):
    __tablename__ = "specialisms"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "code", name="uq_specialisms_tenant_id_code"),
    )

    code: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    display: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    # provenance: 'local' (PoC seed/admin) vs a master-data source id at MVP
    source: Mapped[str] = mapped_column(
        sa.String(64), nullable=False, server_default=sa.text("'local'")
    )


class PractitionerRoleSpecialism(TenantOwnedEntity):
    __tablename__ = "practitioner_role_specialisms"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "practitioner_role_id",
            "specialism_id",
            name="uq_practitioner_role_specialisms_role_specialism",
        ),
    )

    practitioner_role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("practitioner_roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    specialism_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("specialisms.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
