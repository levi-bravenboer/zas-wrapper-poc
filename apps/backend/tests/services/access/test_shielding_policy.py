"""Shielding policy unit tests (REQ-FUN-161): default-deny, carepath-over-
global precedence, patient-initiated items, structural omission."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ItemCategory, ShieldingAudience
from app.db.models.access.shielding import ShieldedItem, ShieldingRule
from app.db.models.pathway import Pathway
from app.db.models.patient import Patient
from app.db.models.user import User
from app.services.access.shielding import ShieldingPolicy, apply_shielding
from scripts.seed_organisations import seed_organisations
from scripts.seed_patients import seed_patients
from scripts.seed_users import ADMIN_USER_ID

pytestmark = pytest.mark.usefixtures("_autoclean")


@pytest.fixture(autouse=True)
def _autoclean(clean_tenants: None) -> None:
    """Wipe tenant-scoped tables around every shielding test."""


@pytest.fixture
async def domain(db_session: AsyncSession, seeded_zas_users: list[User]) -> tuple[Patient, Pathway]:
    del seeded_zas_users
    await seed_organisations(db_session)
    await db_session.commit()
    patients = await seed_patients(db_session)
    await db_session.commit()
    pathway = Pathway(
        name="Shielding pathway",
        tenant_id=patients[0].tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
    )
    db_session.add(pathway)
    await db_session.commit()
    return patients[0], pathway


async def test_default_deny_without_rule(
    db_session: AsyncSession, domain: tuple[Patient, Pathway]
) -> None:
    patient, pathway = domain
    policy = ShieldingPolicy(db_session)
    assert not await policy.is_released(
        patient.tenant_id,
        category=ItemCategory.DIARY,
        audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
        pathway_id=pathway.id,
    )


async def test_carepath_rule_overrides_global(
    db_session: AsyncSession, domain: tuple[Patient, Pathway]
) -> None:
    patient, pathway = domain
    audit = {
        "tenant_id": patient.tenant_id,
        "created_by": ADMIN_USER_ID,
        "updated_by": ADMIN_USER_ID,
    }
    db_session.add_all(
        [
            ShieldingRule(
                pathway_id=None,
                item_category=ItemCategory.PARAMETERS,
                audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
                released=True,
                **audit,
            ),
            ShieldingRule(
                pathway_id=pathway.id,
                item_category=ItemCategory.PARAMETERS,
                audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
                released=False,
                **audit,
            ),
        ]
    )
    await db_session.commit()
    policy = ShieldingPolicy(db_session)

    # carepath-specific withhold wins on the carepath…
    assert not await policy.is_released(
        patient.tenant_id,
        category=ItemCategory.PARAMETERS,
        audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
        pathway_id=pathway.id,
    )
    # …while the global release applies elsewhere
    assert await policy.is_released(
        patient.tenant_id,
        category=ItemCategory.PARAMETERS,
        audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
        pathway_id=None,
    )


async def test_apply_shielding_structural_omission(
    db_session: AsyncSession, domain: tuple[Patient, Pathway]
) -> None:
    patient, _ = domain
    db_session.add(
        ShieldingRule(
            pathway_id=None,
            item_category=ItemCategory.PARAMETERS,
            audience=ShieldingAudience.REPRESENTATIVE,
            released=True,
            tenant_id=patient.tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    await db_session.commit()
    policy = ShieldingPolicy(db_session)

    payload = {
        ItemCategory.PARAMETERS: {"weight": 82},
        ItemCategory.DIARY: ["entry"],
    }
    filtered = await apply_shielding(
        policy,
        payload,
        tenant_id=patient.tenant_id,
        audience=ShieldingAudience.REPRESENTATIVE,
    )
    assert filtered == {ItemCategory.PARAMETERS: {"weight": 82}}
    assert ItemCategory.DIARY not in filtered, "withheld categories are absent, not nulled"


async def test_patient_initiated_item_shielding(
    db_session: AsyncSession, domain: tuple[Patient, Pathway]
) -> None:
    patient, _ = domain
    db_session.add(
        ShieldedItem(
            patient_id=patient.id,
            item_ref="questionnaire_answer:abc",
            audience=ShieldingAudience.REPRESENTATIVE,
            tenant_id=patient.tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    await db_session.commit()
    policy = ShieldingPolicy(db_session)

    assert await policy.is_item_shielded(
        patient_id=patient.id,
        item_ref="questionnaire_answer:abc",
        audience=ShieldingAudience.REPRESENTATIVE,
    )
    assert not await policy.is_item_shielded(
        patient_id=patient.id,
        item_ref="questionnaire_answer:abc",
        audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
    )
