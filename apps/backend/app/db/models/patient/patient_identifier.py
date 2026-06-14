# FHIR R4 `Patient.identifier`. Child rows live in a separate table from
# day one: a single patient can carry multiple identifiers (INSZ + HiX MRN
# + Luscii ref), and FHIR `Identifier` is shaped as `(system, value, use)`.
# Storing them inline as JSON would block per-identifier search and the
# partial-unique constraint we rely on for idempotent sync.
#
# `system` is a URI (constants in `app/core/identifiers.py`). `value` is
# free-text — the system tells the receiver how to interpret the value.
# `(patient_id, system, value)` is partial-unique under
# `deleted_at IS NULL` so soft-deleted rows do not block re-import.

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import AuditableEntity

if TYPE_CHECKING:
    from app.db.models.patient.patient import Patient


class PatientIdentifier(AuditableEntity):
    __tablename__ = "patient_identifiers"
    __table_args__ = (
        sa.Index(
            "uq_patient_identifiers_patient_system_value",
            "patient_id",
            "system",
            "value",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index("ix_patient_identifiers_system_value", "system", "value"),
        # Luscii patient UUIDs are unique ACROSS patients (one Luscii patient
        # maps to at most one of ours); other systems stay per-patient-unique
        # only. Scoped by system so e.g. shared-MRN edge cases keep working.
        sa.Index(
            "uq_patient_identifiers_luscii_value",
            "value",
            unique=True,
            postgresql_where=sa.text("system = 'urn:zas:luscii:patient' AND deleted_at IS NULL"),
        ),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    system: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    value: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    # FHIR `Identifier.use` (`usual | official | temp | secondary | old`).
    # Optional, free-text — we do not enum-constrain it to match FHIR's
    # extensible binding.
    use: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)

    patient: Mapped[Patient] = relationship("Patient", back_populates="identifiers")
