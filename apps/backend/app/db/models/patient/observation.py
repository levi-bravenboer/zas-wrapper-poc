# Local FHIR `Observation` (subset) — a single numeric measurement entered
# in-product, independent of the Luscii proxy (which persists nothing). One
# row per recorded reading. `code` / `code_system` / `unit` are server-derived
# from the supported-type allow-list (heart rate only for now), never trusted
# from the client. No status/interpretation/threshold fields: values are a
# pure manual log with no clinical logic attached (MDR-gated, deferred).

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantOwnedEntity

if TYPE_CHECKING:
    from app.db.models.patient.patient import Patient


class Observation(TenantOwnedEntity):
    __tablename__ = "observations"
    __realtime_resource__: ClassVar[str | None] = "observations"
    __audited__: ClassVar[bool] = True
    __audit_exclude__: ClassVar[frozenset[str]] = frozenset(
        {"created_by", "updated_by", "deleted_by"}
    )
    __table_args__ = (
        sa.Index("ix_observations_patient_effective", "patient_id", "effective_date_time"),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    code_system: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    value: Mapped[Decimal] = mapped_column(sa.Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    effective_date_time: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False
    )
    performer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    patient: Mapped[Patient] = relationship("Patient", back_populates="observations")
