# SYNTHETIC ONLY — see openspec/project.md no-PHI invariant.
#
# Seeds ~10 demo patients under the `zas` tenant, all attached to the
# `Rugrevalidatie` team org (seeded by `seed_organisations`). The seed
# caregiver (`caregiver@zas.local`) is the audit actor — patients live
# inside their care team in the demo, and a future `care-teams-base`
# visibility filter will key off this affiliation.
#
# Every INSZ is freshly generated with a deterministic `random.Random(2026)`
# and validated via `is_valid_insz`. The numbers are Mod-97-valid but
# synthetic — they MUST NOT collide with any real Rijksregisternummer.
# Idempotency keys off `(tenant_id, external_system='seed', external_ref)`:
# a second run resolves to the existing row through the partial-unique
# `uq_patients_tenant_external` index without inserting a duplicate.

"""Idempotent seed of synthetic demo patients under the `zas` tenant.

Run: `python -m scripts.seed_patients` (or `python scripts/seed_patients.py`).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from random import Random
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.access.rbac.resolver import build_session_user
from app.core.enums.patient import Gender, PatientSource
from app.core.identifiers import INSZ_SYSTEM
from app.core.validators.insz import is_valid_insz
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.patient import Patient, PatientIdentifier
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from scripts._db import run_script
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import CAREGIVER_EMAIL

logger = logging.getLogger(__name__)

SEED_EXTERNAL_SYSTEM = "seed"
SEED_RNG_SEED = 2026
SEED_PATIENT_COUNT = 10


class _ZasTenantMissingError(RuntimeError):
    """Raised when `seed_patients` runs before the `zas` tenant exists."""


class _SeedCaregiverMissingError(RuntimeError):
    """Raised when `seed_patients` runs before the demo caregiver exists."""


@dataclass(frozen=True, slots=True)
class _Profile:
    given_name: str
    family_name: str
    birth_date: date
    gender: Gender


_PROFILES: tuple[_Profile, ...] = (
    _Profile("Sven", "Janssens", date(2002, 3, 12), Gender.MALE),
    _Profile("Anke", "Peeters", date(2001, 7, 4), Gender.FEMALE),
    _Profile("Tom", "Maes", date(2003, 11, 23), Gender.MALE),
    _Profile("Ella", "De Smet", date(2000, 1, 30), Gender.FEMALE),
    _Profile("Jonas", "Claes", date(2002, 9, 18), Gender.MALE),
    _Profile("Lien", "Willems", date(2004, 5, 6), Gender.FEMALE),
    _Profile("Mehmet", "Demir", date(2001, 12, 1), Gender.MALE),
    _Profile("Sophie", "Van Damme", date(2003, 2, 14), Gender.FEMALE),
    _Profile("Robin", "Mertens", date(2002, 8, 27), Gender.OTHER),
    _Profile("Noor", "El Amrani", date(2001, 4, 9), Gender.UNKNOWN),
)


def _synthetic_insz(rng: Random, birth: date) -> str:
    """Generate a Mod-97-valid 11-digit synthetic INSZ for a post-2000 birth.

    The Belgian eHealth check rule for post-2000 births is
    `check == 97 - (int("2" + serial9) mod 97)` where `serial9` is the
    nine leading digits (`YYMMDDsss`). A modulus of zero would yield a
    check value of 97, which still fits in two digits and is accepted by
    `is_valid_insz` (the post-2000 branch reproduces the same 97). We
    retry under the rare 0-modulus only if the formatted value fails
    re-validation — never observed at this seed, kept as a belt-and-braces
    safety net.
    """

    for _ in range(8):
        serial = rng.randint(1, 999)
        serial9 = f"{birth.year % 100:02d}{birth.month:02d}{birth.day:02d}{serial:03d}"
        check = 97 - (int("2" + serial9) % 97)
        candidate = f"{serial9}{check:02d}"
        if is_valid_insz(candidate):
            return candidate
    raise RuntimeError("could not generate a valid synthetic INSZ — check seed")


async def seed_patients(session: AsyncSession) -> list[Patient]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        logger.error(
            "cannot seed patients: %s tenant missing — run seed_tenant first",
            ZAS_TENANT_SLUG,
        )
        raise _ZasTenantMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    user_repo = UserRepository(session)
    caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
    if caregiver is None:
        logger.error(
            "cannot seed patients: caregiver %s missing — run seed_users first",
            CAREGIVER_EMAIL,
        )
        raise _SeedCaregiverMissingError(f"{CAREGIVER_EMAIL} missing — run seed_users first")

    rng = Random(SEED_RNG_SEED)
    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = await build_session_user(session, caregiver)
    try:
        seeded: list[Patient] = []
        for index, profile in enumerate(_PROFILES[:SEED_PATIENT_COUNT], start=1):
            patient = await _get_or_create_patient(
                session,
                tenant_id=tenant.id,
                index=index,
                profile=profile,
                rng=rng,
            )
            seeded.append(patient)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return seeded


async def _get_or_create_patient(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    index: int,
    profile: _Profile,
    rng: Random,
) -> Patient:
    external_ref = f"seed:patient:{index:02d}"
    existing = (
        await session.execute(
            select(Patient).where(
                Patient.tenant_id == tenant_id,
                Patient.external_system == SEED_EXTERNAL_SYSTEM,
                Patient.external_ref == external_ref,
                Patient.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        # Advance the RNG so a re-run produces the same INSZ stream for
        # any newly-inserted rows that follow an already-seeded gap.
        _synthetic_insz(rng, profile.birth_date)
        logger.info("patient external_ref=%s already present", external_ref)
        return existing

    insz = _synthetic_insz(rng, profile.birth_date)
    patient = Patient(
        primary_organisation_id=RUGREVAL_TEAM_ORG_ID,
        given_name=profile.given_name,
        family_name=profile.family_name,
        birth_date=profile.birth_date,
        gender=profile.gender,
        source=PatientSource.LOCAL,
        external_system=SEED_EXTERNAL_SYSTEM,
        external_ref=external_ref,
    )
    patient.identifiers = [PatientIdentifier(system=INSZ_SYSTEM, value=insz, use="official")]
    session.add(patient)
    await session.flush()
    logger.info(
        "seeded patient external_ref=%s name=%s %s",
        external_ref,
        profile.given_name,
        profile.family_name,
    )
    return patient


async def _seed(session: AsyncSession) -> None:
    await seed_patients(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
