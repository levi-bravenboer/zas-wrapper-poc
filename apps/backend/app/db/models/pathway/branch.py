# First-class entity for decision-block branches. App-side validation (D19)
# rejects branch creation on blocks whose catalogue entry does not advertise
# branching support. Branches are ordered within their owning block.

from __future__ import annotations
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayBranch(TenantOwnedEntity):
    __tablename__ = "pathway_branch"
    __table_args__ = (
        sa.UniqueConstraint("block_id", "ord", name="uq_pathway_branch_block_id_ord"),
    )

    block_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    ord: Mapped[int] = mapped_column(sa.Integer, nullable=False)
