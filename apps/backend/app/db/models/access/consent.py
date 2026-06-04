# Minimal consent record (REQ-FUN-1/42): the gate on external grants. Tuple
# derivation emits external verb tuples only while the referenced consent is
# ACTIVE — revoking flips status + revoked_at and the outbox drops the
# tuples. The full informed-consent flow (signed documents, FHIR Consent)
# stays BL-017; this row is deliberately just the authorization fact.

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.access import ConsentStatus
from app.db.base import TenantOwnedEntity


class Consent(TenantOwnedEntity):
    __tablename__ = "consents"
    __realtime_resource__: ClassVar[str | None] = None

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # what the patient consented to, e.g. 'external_collaboration'
    scope: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    status: Mapped[ConsentStatus] = mapped_column(
        sa.Enum(
            ConsentStatus,
            name="consent_status",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
        server_default=sa.text("'active'"),
    )
    granted_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    revoked_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
