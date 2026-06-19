from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM
from app.db.models.organisation import Organisation
from app.db.models.tenant import Tenant
from app.db.models.user import User
from tests.db.conftest import seed_admin_user


async def _bootstrap(session: AsyncSession) -> tuple[Tenant, User]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor = await seed_admin_user(session, tenant_id=tenant.id)
    return tenant, actor


async def test_unknown_type_code_passes_through(db_session: AsyncSession) -> None:
    tenant, actor = await _bootstrap(db_session)
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="custom",
        type_code="custom-unit",
        type_system="https://example.org/custom",
        type_display="Custom",
        parent_organisation_id=None,
    )
    db_session.add(org)
    await db_session.commit()

    fetched = (
        await db_session.execute(select(Organisation).where(Organisation.id == org.id))
    ).scalar_one()
    assert fetched.type_code == "custom-unit"


async def test_type_system_server_default_is_fhir_uri(db_session: AsyncSession) -> None:
    tenant, actor = await _bootstrap(db_session)
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        type_display=None,
        parent_organisation_id=None,
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    assert org.type_system == ORGANISATION_TYPE_SYSTEM
