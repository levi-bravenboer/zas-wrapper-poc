# MDR-relevant: the Luscii clinical-path payload is OPAQUE. We never
# interpret, parse, or transform it. Stored as `text` (Naming Exception 2),
# NOT jsonb — backend never queries into it. The base class still gives us
# an `id` PK; the `block_id` FK is UNIQUE so the table stays one-row-per-block.

from __future__ import annotations
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayBlockLusciiExtension(TenantOwnedEntity):
    __tablename__ = "pathway_block_luscii_extension"

    block_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    payload: Mapped[str] = mapped_column(sa.Text, nullable=False)
