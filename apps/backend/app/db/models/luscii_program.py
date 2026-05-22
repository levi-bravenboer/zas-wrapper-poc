"""Local cache of Luscii care-pathway programs.

A single jsonb-payload table keyed by Luscii's own program id. Both stub
mode (this change) and future live mode read from here; live mode also
writes to it on adapter refresh.

The full payload shape lives in `app.adapters.luscii.program.LusciiProgramData`.
Stored as `data: JSONB` so the schema can evolve with Luscii's model
without forcing migrations every time.

Not tenant-owned: the Luscii catalogue is global across the org (today
every tenant sees the same programs). Per-tenant gating, when it lands,
will arrive via a separate `tenant_luscii_program` join table.

Realtime: writes publish on the `luscii_program` topic; the orchestrator
auto-invalidates `['luscii_program', ...]` TanStack keys via the existing
`RealtimeInvalidationProvider`.
"""

from __future__ import annotations

from typing import Any, ClassVar

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Entity


class LusciiProgram(Entity):
    __tablename__ = "luscii_program"
    __realtime_resource__: ClassVar[str | None] = "luscii_program"

    # Override Entity.id (UUID) with Luscii's own string id as primary key.
    # The string id flows into `pathway_block.config.program_id` and on to
    # the orchestrator unchanged — keeping the same value end-to-end avoids
    # a lookup table.
    id: Mapped[str] = mapped_column(  # type: ignore[assignment]
        sa.Text,
        primary_key=True,
    )

    data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
