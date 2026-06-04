"""Shielding policy service (REQ-FUN-161) — the response-shape authority.

Division of labour (access-entitlements design D5):
- Keto answers WHO sees the patient at all (`view` vs `view_shielded`);
- THIS service answers WHICH item categories appear in a limited-sight
  response. Neither overrides the other.

Rules: `shielding_rules` rows keyed by (carepath?, category, audience).
- **Absence of a matching rule means SHIELDED** (default-deny — "data is
  shielded unless explicitly released to a role").
- A carepath-specific rule overrides the global (pathway_id IS NULL) rule.
- `shielded_items` rows (patient-initiated) withhold a specific item from
  an audience regardless of release rules.

Wiring contract: response serialization for patient-scoped payloads that
carry any `ItemCategory` content MUST pass through `apply_shielding` /
`ShieldingPolicy.is_released` — routes never hand-roll shielding decisions.
Subjects holding `view_shielded` (care team, org chain, break-glass) bypass
this service entirely (full sight by construction). The PoC API does not
yet serialize any of the five categories; this module is the enforcement
point those serializers are built on when they land (questionnaires/diary
are MVP surfaces).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ItemCategory, ShieldingAudience
from app.db.models.access.shielding import ShieldedItem, ShieldingRule


class ShieldingPolicy:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def is_released(
        self,
        tenant_id: UUID,
        *,
        category: ItemCategory,
        audience: ShieldingAudience,
        pathway_id: UUID | None = None,
    ) -> bool:
        """Default-deny release check with carepath-over-global precedence."""

        rows = (
            (
                await self._session.execute(
                    select(ShieldingRule).where(
                        ShieldingRule.tenant_id == tenant_id,
                        ShieldingRule.item_category == category,
                        ShieldingRule.audience == audience,
                        ShieldingRule.deleted_at.is_(None),
                        (ShieldingRule.pathway_id == pathway_id)
                        | (ShieldingRule.pathway_id.is_(None)),
                    )
                )
            )
            .scalars()
            .all()
        )
        specific = next((r for r in rows if r.pathway_id is not None), None)
        if specific is not None:
            return specific.released
        general = next((r for r in rows if r.pathway_id is None), None)
        if general is not None:
            return general.released
        return False  # no rule → shielded (default-deny)

    async def released_categories(
        self,
        tenant_id: UUID,
        *,
        audience: ShieldingAudience,
        pathway_id: UUID | None = None,
    ) -> set[ItemCategory]:
        return {
            category
            for category in ItemCategory
            if await self.is_released(
                tenant_id, category=category, audience=audience, pathway_id=pathway_id
            )
        }

    async def is_item_shielded(
        self,
        *,
        patient_id: UUID,
        item_ref: str,
        audience: ShieldingAudience,
    ) -> bool:
        """Patient-initiated shielding: withheld regardless of release rules."""

        row = await self._session.scalar(
            select(ShieldedItem.id)
            .where(
                ShieldedItem.patient_id == patient_id,
                ShieldedItem.item_ref == item_ref,
                ShieldedItem.audience == audience,
                ShieldedItem.deleted_at.is_(None),
            )
            .limit(1)
        )
        return row is not None


async def apply_shielding(
    policy: ShieldingPolicy,
    payload: dict[ItemCategory, Any],
    *,
    tenant_id: UUID,
    audience: ShieldingAudience,
    pathway_id: UUID | None = None,
) -> dict[ItemCategory, Any]:
    """Filter a category-keyed payload for a limited-sight audience.

    Structural omission: withheld categories are ABSENT from the result —
    no placeholder values are serialized (placeholders are a UI concern).
    """

    released = await policy.released_categories(tenant_id, audience=audience, pathway_id=pathway_id)
    return {category: value for category, value in payload.items() if category in released}
