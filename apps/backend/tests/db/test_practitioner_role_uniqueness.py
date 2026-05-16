from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.core.enums.user import Role
from app.db.models.organisation import Organisation
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.tenant import Tenant
from app.db.models.user import User


async def _bootstrap(
    session: AsyncSession,
) -> tuple[Tenant, Practitioner, Organisation]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor_id = uuid.uuid4()
    actor = User(
        id=actor_id,
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        email="a@example.test",
        password_hash="hash",
        display_name="a",
        role=Role.CAREGIVER,
        is_active=True,
    )
    session.add(actor)
    await session.flush()
    org = Organisation(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    practitioner = Practitioner(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        user_id=actor.id,
        given_name="A",
        family_name="A",
    )
    session.add(practitioner)
    await session.flush()
    return tenant, practitioner, org


async def test_two_open_rows_for_same_practitioner_and_org_rejected(
    db_session: AsyncSession,
) -> None:
    tenant, practitioner, org = await _bootstrap(db_session)
    audit = {"created_by": practitioner.created_by, "updated_by": practitioner.updated_by}
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=org.id,
            code=PractitionerRoleCode.NURSE,
            **audit,
        )
    )
    await db_session.flush()
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=org.id,
            code=PractitionerRoleCode.NURSE,
            **audit,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_closed_period_does_not_block_reopen(db_session: AsyncSession) -> None:
    tenant, practitioner, org = await _bootstrap(db_session)
    audit = {"created_by": practitioner.created_by, "updated_by": practitioner.updated_by}
    now = datetime.now(UTC)
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=org.id,
            code=PractitionerRoleCode.NURSE,
            period_start=now - timedelta(days=10),
            period_end=now - timedelta(days=1),
            **audit,
        )
    )
    await db_session.flush()
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=org.id,
            code=PractitionerRoleCode.NURSE,
            period_start=now,
            **audit,
        )
    )
    await db_session.flush()


async def test_two_open_primary_rows_rejected(db_session: AsyncSession) -> None:
    tenant, practitioner, org = await _bootstrap(db_session)
    audit = {"created_by": practitioner.created_by, "updated_by": practitioner.updated_by}
    other_org = Organisation(
        tenant_id=tenant.id,
        created_by=practitioner.created_by,
        updated_by=practitioner.created_by,
        name="dept",
        type_code="dept",
        parent_organisation_id=org.id,
    )
    db_session.add(other_org)
    await db_session.flush()
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=org.id,
            code=PractitionerRoleCode.NURSE,
            is_primary=True,
            **audit,
        )
    )
    await db_session.flush()
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=other_org.id,
            code=PractitionerRoleCode.NURSE,
            is_primary=True,
            **audit,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
