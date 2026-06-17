# Aggregate root for the pathway-builder domain (D1, D16). No design-time
# entry block — enrollment (F4, separate change) picks the start. Soft-delete
# via `Entity.deleted_at`; `BaseRepository.list()` filters those out.

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class Pathway(TenantOwnedEntity):
    __tablename__ = "pathway"
    __realtime_resource__: ClassVar[str | None] = None
    # NOT __audited__: pathway authoring is captured as explicit domain events
    # (app/services/pathway/audit_events.py — create/edit/delete/publish/fork
    # with event_code + edit coalescing), so auto-diff here would double-log.

    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    clinical_goal: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    patient_goal: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
