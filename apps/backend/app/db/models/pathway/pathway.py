# Aggregate root for the pathway-builder domain (D1, D16). No design-time
# entry block — enrollment (F4, separate change) picks the start. Soft-delete
# via `Entity.deleted_at`; `BaseRepository.list()` filters those out.

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class Pathway(TenantOwnedEntity):
    __tablename__ = "pathway"

    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
