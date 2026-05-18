# Pathway-version row. Owns the structural snapshot (phases, lanes, blocks,
# edges, branches, time markers, timing values) of one editable revision of a
# pathway. Concept rows are mutable (autosaved); flipping to `published` makes
# them immutable. See `openspec/changes/pathway-builder-base/specs/pathway-version/spec.md`
# and design.md D36-D45 for the decision trail.

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayVersion(TenantOwnedEntity):
    __tablename__ = "pathway_version"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "pathway_id", "version_no", name="uq_pathway_version_pathway_id_version_no"
        ),
        sa.Index(
            "ix_pathway_version_pathway_status_published",
            "pathway_id",
            "status",
            sa.text("published_at DESC"),
        ),
        sa.Index(
            "uq_pathway_version_one_concept_per_pathway",
            "pathway_id",
            unique=True,
            postgresql_where=sa.text("status = 'concept' AND deleted_at IS NULL"),
        ),
        sa.CheckConstraint(
            "status IN ('concept', 'published', 'archived')",
            name="ck_pathway_version_status",
        ),
        sa.CheckConstraint(
            "kind IN ('initial', 'fork-from-publish', 'restore-from-version')",
            name="ck_pathway_version_kind",
        ),
        sa.CheckConstraint(
            "(status = 'published') = (published_at IS NOT NULL)",
            name="ck_pathway_version_published_at_matches_status",
        ),
        sa.CheckConstraint(
            "(status = 'published') = (published_by IS NOT NULL)",
            name="ck_pathway_version_published_by_matches_status",
        ),
    )

    pathway_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_no: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    status: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    kind: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    derived_from_version_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_version.id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str | None] = mapped_column(sa.String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    published_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
