"""Shielding rule management — admin CRUD over `shielding_rules`."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ItemCategory, ShieldingAudience
from app.core.errors import AppError
from app.db.models.access.shielding import ShieldingRule
from app.db.models.pathway.pathway import Pathway
from app.schemas.auth.auth import SessionUser
from app.services.pathway.errors import PathwayNotFoundError


class ShieldingRuleNotFoundError(AppError):
    code = "not-found.shielding_rule.not_found"
    status_code = 404
    message = "Shielding rule not found."


class ShieldingRulesService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_rules(self, tenant_id: UUID) -> list[ShieldingRule]:
        rows = await self._session.execute(
            select(ShieldingRule)
            .where(ShieldingRule.tenant_id == tenant_id, ShieldingRule.deleted_at.is_(None))
            .order_by(ShieldingRule.item_category, ShieldingRule.audience)
        )
        return list(rows.scalars().all())

    async def upsert_rule(
        self,
        current_user: SessionUser,
        *,
        pathway_id: UUID | None,
        item_category: ItemCategory,
        audience: ShieldingAudience,
        released: bool,
    ) -> ShieldingRule:
        if pathway_id is not None:
            pathway = await self._session.get(Pathway, pathway_id)
            if pathway is None or pathway.tenant_id != current_user.tenant_id or pathway.deleted_at:
                raise PathwayNotFoundError()
        rule = (
            await self._session.execute(
                select(ShieldingRule).where(
                    ShieldingRule.tenant_id == current_user.tenant_id,
                    ShieldingRule.pathway_id.is_(None)
                    if pathway_id is None
                    else ShieldingRule.pathway_id == pathway_id,
                    ShieldingRule.item_category == item_category,
                    ShieldingRule.audience == audience,
                    ShieldingRule.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if rule is None:
            rule = ShieldingRule(
                pathway_id=pathway_id, item_category=item_category, audience=audience
            )
            self._session.add(rule)
        rule.released = released
        await self._session.commit()
        await self._session.refresh(rule)
        return rule

    async def delete_rule(self, current_user: SessionUser, rule_id: UUID) -> None:
        rule = await self._session.get(ShieldingRule, rule_id)
        if rule is None or rule.tenant_id != current_user.tenant_id or rule.deleted_at:
            raise ShieldingRuleNotFoundError()
        await self._session.delete(rule)
        await self._session.commit()
