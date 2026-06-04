# Shielding configuration (REQ-FUN-161). Division of labour (design D5):
# Keto answers WHO sees the patient (view vs view_shielded); these rows answer
# WHICH item categories appear in a limited-sight response. Absence of a
# matching rule == shielded (default-deny). Carepath-specific rules override
# global (pathway_id IS NULL) rules. Evaluated only through
# app/services/access/shielding.py — routes never hand-roll decisions.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.access import ItemCategory, ShieldingAudience
from app.db.base import TenantOwnedEntity

_ITEM_CATEGORY = sa.Enum(
    ItemCategory,
    name="shielding_item_category",
    native_enum=True,
    create_constraint=True,
    values_callable=lambda enum_cls: [m.value for m in enum_cls],
)
_AUDIENCE = sa.Enum(
    ShieldingAudience,
    name="shielding_audience",
    native_enum=True,
    create_constraint=True,
    values_callable=lambda enum_cls: [m.value for m in enum_cls],
)


class ShieldingRule(TenantOwnedEntity):
    __tablename__ = "shielding_rules"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        # NULLS NOT DISTINCT so at most one global rule per (category, audience)
        sa.UniqueConstraint(
            "tenant_id",
            "pathway_id",
            "item_category",
            "audience",
            name="uq_shielding_rules_scope",
            postgresql_nulls_not_distinct=True,
        ),
    )

    # NULL = global rule; a pathway-specific rule overrides it
    pathway_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    item_category: Mapped[ItemCategory] = mapped_column(_ITEM_CATEGORY, nullable=False)
    audience: Mapped[ShieldingAudience] = mapped_column(_AUDIENCE, nullable=False)
    released: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )


class ShieldedItem(TenantOwnedEntity):
    __tablename__ = "shielded_items"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "tenant_id",
            "patient_id",
            "item_ref",
            "audience",
            name="uq_shielded_items_patient_item_audience",
        ),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # opaque item reference, e.g. 'questionnaire_answer:<uuid>'
    item_ref: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    audience: Mapped[ShieldingAudience] = mapped_column(_AUDIENCE, nullable=False)
