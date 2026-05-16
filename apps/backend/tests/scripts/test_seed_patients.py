from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identifiers import INSZ_SYSTEM
from app.core.validators.insz import is_valid_insz
from app.db.models.patient import Patient, PatientIdentifier
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID, seed_organisations
from scripts.seed_patients import (
    SEED_EXTERNAL_SYSTEM,
    SEED_PATIENT_COUNT,
    _SeedCaregiverMissingError,
    _ZasTenantMissingError,
    seed_patients,
)
from scripts.seed_tenant import ZAS_TENANT_ID, seed_zas_tenant
from scripts.seed_users import seed_users


async def _seed_prereqs(session: AsyncSession) -> None:
    await seed_zas_tenant(session)
    await session.commit()
    await seed_users(session)
    await session.commit()
    await seed_organisations(session)
    await session.commit()


async def test_seed_patients_inserts_demo_cohort(db_session: AsyncSession) -> None:
    await _seed_prereqs(db_session)

    patients = await seed_patients(db_session)
    await db_session.commit()

    assert len(patients) == SEED_PATIENT_COUNT
    for patient in patients:
        assert patient.tenant_id == ZAS_TENANT_ID
        assert patient.primary_organisation_id == RUGREVAL_TEAM_ORG_ID
        assert patient.external_system == SEED_EXTERNAL_SYSTEM
        assert patient.external_ref is not None and patient.external_ref.startswith("seed:patient:")
        # Audit hook stamped from caregiver actor.
        assert patient.created_by is not None
        assert patient.updated_by == patient.created_by


async def test_seed_patients_all_inszs_valid(db_session: AsyncSession) -> None:
    await _seed_prereqs(db_session)
    await seed_patients(db_session)
    await db_session.commit()

    identifiers = (
        (
            await db_session.execute(
                select(PatientIdentifier).where(PatientIdentifier.system == INSZ_SYSTEM)
            )
        )
        .scalars()
        .all()
    )
    assert len(identifiers) == SEED_PATIENT_COUNT
    for identifier in identifiers:
        assert is_valid_insz(identifier.value)


async def test_seed_patients_is_idempotent(db_session: AsyncSession) -> None:
    await _seed_prereqs(db_session)

    await seed_patients(db_session)
    await db_session.commit()
    await seed_patients(db_session)
    await db_session.commit()

    count = (await db_session.execute(select(func.count()).select_from(Patient))).scalar_one()
    assert count == SEED_PATIENT_COUNT


async def test_seed_patients_requires_existing_tenant(db_session: AsyncSession) -> None:
    with pytest.raises(_ZasTenantMissingError):
        await seed_patients(db_session)


async def test_seed_patients_requires_existing_caregiver(
    db_session: AsyncSession,
) -> None:
    await seed_zas_tenant(db_session)
    await db_session.commit()
    with pytest.raises(_SeedCaregiverMissingError):
        await seed_patients(db_session)
