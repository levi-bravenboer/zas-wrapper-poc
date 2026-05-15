# FHIR R4 `Patient` (subset). One row per clinical subject. Demographics
# (`given_name`, `family_name`, `birth_date`, `gender`) live on this row;
# alternate names, addresses, and telecoms are deferred until the HiX
# adapter lands (see openspec/changes/patients-base/design.md D6).
#
# The patient is a *clinical subject*, never an authenticatable identity:
# no `password_hash`, no `auth_provider_sub`, no session columns. This is
# enforced structurally (no such columns exist) and guarded by a source
# test (`tests/db/test_patients_no_credentials.py`).
#
# Sync seam: `source` + `(external_system, external_ref, external_version)`
# is what the future HiX/Luscii adapters use to upsert idempotently.
# `last_synced_at` is the wall-clock of the last successful sync round.

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.patient import Gender, PatientSource
from app.db.base import TenantOwnedEntity

if TYPE_CHECKING:
    from app.db.models.patient.patient_identifier import PatientIdentifier


class Patient(TenantOwnedEntity):
    __tablename__ = "patients"
    __realtime_resource__: ClassVar[str | None] = "patients"
    __table_args__ = (
        # Partial unique on the sync key: a given external system can only
        # map to one patient per tenant. `deleted_at IS NULL` lets a soft
        # delete free the slot for re-import.
        sa.Index(
            "uq_patients_tenant_external",
            "tenant_id",
            "external_system",
            "external_ref",
            unique=True,
            postgresql_where=sa.text("external_ref IS NOT NULL AND deleted_at IS NULL"),
        ),
        # Prefix-search path for `GET /patients?family_name=...`.
        sa.Index("ix_patients_tenant_family_name", "tenant_id", "family_name"),
    )

    primary_organisation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("organisations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # FHIR-shaped demographics. `given_name` is the FHIR `name.given[0]`;
    # full multi-name support is deferred to a future `patient_names` table.
    given_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    family_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    gender: Mapped[Gender] = mapped_column(
        sa.Enum(
            Gender,
            name="gender",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )

    # Sync columns.
    source: Mapped[PatientSource] = mapped_column(
        sa.Enum(
            PatientSource,
            name="patient_source",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
        server_default=sa.text("'local'"),
    )
    external_system: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    external_ref: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    external_version: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    identifiers: Mapped[list[PatientIdentifier]] = relationship(
        "PatientIdentifier",
        back_populates="patient",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
