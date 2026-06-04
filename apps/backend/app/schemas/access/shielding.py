"""Shielding rule payloads (REQ-FUN-161)."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.access import ItemCategory, ShieldingAudience


class ShieldingRuleUpsert(BaseModel):
    """Upsert keyed by (pathway_id, item_category, audience);
    `pathway_id = null` targets the global rule."""

    pathway_id: UUID | None = None
    item_category: ItemCategory
    audience: ShieldingAudience
    released: bool


class ShieldingRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pathway_id: UUID | None
    item_category: ItemCategory
    audience: ShieldingAudience
    released: bool
