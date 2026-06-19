# Patient↔Luscii connection (patient-luscii-connection change).
#
# A first-class, status-bearing link between one of our patients and a Luscii
# patient. Replaces the degenerate `PatientIdentifier`
# (`system = urn:zas:luscii:patient`) link: a patient can hold MANY
# connections (one per Luscii patient — each Luscii patient runs exactly one
# program), and connections carry an `active | inactive` lifecycle so past
# links survive as history instead of being soft-deleted away.
#
# `program_id` / `program_name` snapshot the linked Luscii patient's current
# program at link time. They let the FE attribute a connection to a carepath
# (match against `external_program` pathway blocks) and label history even
# when Luscii later changes the program; the live read stays authoritative.
#
# Invariants (partial-unique, live rows only — see the alembic migration):
# - one ACTIVE connection per Luscii patient across all our patients
#   (a Luscii patient maps to at most one of ours at a time);
# - one live row per `(patient_id, luscii_patient_id)` so re-linking reuses
#   the existing row instead of duplicating it.
# Deliberately NO "one active per patient" constraint — many active is the point.

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.patient import LusciiConnectionStatus
from app.db.base import AuditableEntity

if TYPE_CHECKING:
    from app.db.models.patient.patient import Patient


class PatientLusciiConnection(AuditableEntity):
    __tablename__ = "patient_luscii_connections"
    __table_args__ = (
        sa.Index(
            "uq_patient_luscii_connections_active_luscii_patient",
            "luscii_patient_id",
            unique=True,
            postgresql_where=sa.text("status = 'active' AND deleted_at IS NULL"),
        ),
        sa.Index(
            "uq_patient_luscii_connections_patient_luscii",
            "patient_id",
            "luscii_patient_id",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    luscii_patient_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    status: Mapped[LusciiConnectionStatus] = mapped_column(
        sa.Enum(
            LusciiConnectionStatus,
            name="luscii_connection_status",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
        server_default=sa.text("'active'"),
    )
    # Snapshot of the Luscii patient's program at link/refresh time.
    program_id: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    program_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

    patient: Mapped[Patient] = relationship("Patient", back_populates="luscii_connections")
