# FHIR R4 `Organization` + `partOf` self-reference. One row per clinical unit
# (hospital, department, ward, team). `type_code` / `type_system` / `type_display`
# mirror the FHIR `CodeableConcept.coding[0]` shape with an extensible binding
# to `http://terminology.hl7.org/CodeSystem/organization-type` — unknown codes
# pass through unchecked at the database layer.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM
from app.db.base import TenantOwnedEntity


class Organisation(TenantOwnedEntity):
    __tablename__ = "organisations"
    __realtime_resource__: ClassVar[str | None] = "organisations"
    __table_args__ = (
        sa.CheckConstraint(
            "parent_organisation_id IS NULL OR parent_organisation_id <> id",
            name="ck_organisations_parent_not_self",
        ),
    )

    parent_organisation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("organisations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    type_code: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    type_system: Mapped[str | None] = mapped_column(
        sa.String(255),
        nullable=True,
        server_default=sa.text(f"'{ORGANISATION_TYPE_SYSTEM}'"),
    )
    type_display: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
