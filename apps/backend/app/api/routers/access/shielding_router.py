"""Shielding rules admin surface (REQ-FUN-161). Audit attribution rides the
standard audit hook (created_by/updated_by); default-deny means deleting a
rule re-shields the category for that audience.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums.user import Role
from app.db.engine import SessionDep
from app.schemas.access.shielding import ShieldingRuleRead, ShieldingRuleUpsert
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.access.shielding.rules_service import ShieldingRulesService

router = APIRouter(tags=["shielding"])

_ADMIN_GUARD = Depends(require_role(Role.ADMIN))


def get_shielding_rules_service(session: SessionDep) -> ShieldingRulesService:
    return ShieldingRulesService(session)


ShieldingRulesServiceDep = Annotated[ShieldingRulesService, Depends(get_shielding_rules_service)]


@router.get(
    "/admin/shielding-rules",
    operation_id="list_shielding_rules",
    response_model=list[ShieldingRuleRead],
)
async def list_shielding_rules(
    service: ShieldingRulesServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[ShieldingRuleRead]:
    rows = await service.list_rules(current_user.tenant_id)
    return [ShieldingRuleRead.model_validate(r) for r in rows]


@router.put(
    "/admin/shielding-rules",
    operation_id="upsert_shielding_rule",
    response_model=ShieldingRuleRead,
)
async def upsert_shielding_rule(
    payload: ShieldingRuleUpsert,
    service: ShieldingRulesServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> ShieldingRuleRead:
    rule = await service.upsert_rule(
        current_user,
        pathway_id=payload.pathway_id,
        item_category=payload.item_category,
        audience=payload.audience,
        released=payload.released,
    )
    return ShieldingRuleRead.model_validate(rule)


@router.delete(
    "/admin/shielding-rules/{rule_id}",
    operation_id="delete_shielding_rule",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_shielding_rule(
    rule_id: UUID,
    service: ShieldingRulesServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> None:
    await service.delete_rule(current_user, rule_id)
