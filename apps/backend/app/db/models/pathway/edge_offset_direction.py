# `pathway_edge_offset_direction` is system-wide (not tenant-owned) — inherits
# plain `Entity`. Seeded from `SEEDED_OFFSET_DIRECTIONS` in
# `app/services/pathway/catalogue.py`: before/after. The table exists so
# `pathway_edge.offset_direction_code` can hold a real FK; the source of truth
# is the seed tuple in catalogue.py.

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Entity

CODE_REGEX = r"^[a-z][a-z0-9-]{0,62}$"


class PathwayEdgeOffsetDirection(Entity):
    __tablename__ = "pathway_edge_offset_direction"
    __table_args__ = (
        sa.CheckConstraint(
            f"code ~ '{CODE_REGEX}'",
            name="ck_pathway_edge_offset_direction_code_format",
        ),
    )

    code: Mapped[str] = mapped_column(sa.String(63), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    ord: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
