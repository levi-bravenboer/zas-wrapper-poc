# `pathway_lane_kind` is system-wide (not tenant-owned) — inherits plain `Entity`.
# Seeded with the four PoC kinds: patient, caregiver, system, external.

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Entity

CODE_REGEX = r"^[a-z][a-z0-9-]{0,62}$"


class PathwayLaneKind(Entity):
    __tablename__ = "pathway_lane_kind"
    __table_args__ = (
        sa.CheckConstraint(f"code ~ '{CODE_REGEX}'", name="ck_pathway_lane_kind_code_format"),
    )

    code: Mapped[str] = mapped_column(sa.String(63), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(sa.String(255), nullable=False)
