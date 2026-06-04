# Carepath access links (REQ-NON-10/12). A pathway links to one or more
# specialisms; optionally specific practitioners are assigned, which NARROWS
# access to exactly those practitioners (assigned-XOR-specialism emission —
# see app/services/access/sync/derive.py; the conditional lives there, never
# in OPL permits).

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwaySpecialism(TenantOwnedEntity):
    __tablename__ = "pathway_specialisms"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "pathway_id", "specialism_id", name="uq_pathway_specialisms_pathway_specialism"
        ),
    )

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    specialism_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("specialisms.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class PathwayPractitioner(TenantOwnedEntity):
    __tablename__ = "pathway_practitioners"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint("pathway_id", "user_id", name="uq_pathway_practitioners_pathway_user"),
    )

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # platform user (Keto subjects are User:<users.id>), not practitioner row
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
