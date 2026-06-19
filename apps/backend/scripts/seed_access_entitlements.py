# POC ONLY — access-entitlements demo data; replace before non-PoC deployment.
#
# Seeds every acceptance beat of scope.md F12:
# - ZAS campuses as child organisations (REQ-NON-15): the org tree becomes
#     ZAS Antwerpen → Campus Stuivenberg → Orthopedie → Rugrevalidatie
#     ZAS Antwerpen → Campus Sint-Vincentius (empty — negative case)
#   plus a campus-level physician whose role covers the Stuivenberg subtree.
# - Specialism master data + role links incl. one MULTI-specialism
#   practitioner (REQ-FUN-28: demo caregiver = orthopedics + physiotherapy).
# - Carepath links (REQ-NON-10/12): Rugrevalidatie → orthopedics
#   (specialism-wide); Hartrevalidatie → cardiology + EXPLICIT assignment to
#   the cardiologist (narrowing demo).
# - External GP with a read+record (no write) profile, an active consent and
#   a grant on the first patient (REQ-FUN-1/42); one shielding release rule
#   (parameters → external professionals) with diary left default-deny
#   (REQ-FUN-161).
# - A multi-role human (caregiver + admin rows sharing one email) for the
#   role-picker flow (REQ-NON-3/FUN-4).
#
# Order: AFTER seed_pathway (links Rugrevalidatie) and BEFORE the Kratos
# import (the new users need identities). Run the reconcile script (or let
# the relay drain) after seeding so Keto converges.

"""Idempotent seed of the access-entitlements demo data.

Run: `python -m scripts.seed_access_entitlements`.
"""

from __future__ import annotations

import logging
import os
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ItemCategory, ShieldingAudience
from app.core.enums.organisation import OrganisationTypeCode
from app.core.enums.practitioner_role import PractitionerRoleCode
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.access.shielding import ShieldingRule
from app.db.models.organisation import Organisation
from app.db.models.pathway import Pathway
from app.db.models.pathway.pathway_access import PathwayPractitioner, PathwaySpecialism
from app.db.models.patient.patient import Patient
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism, Specialism
from app.db.models.user import User
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.password import PasswordHasher
from app.services.access.rbac.resolver import build_session_user
from app.services.pathway.pathway_service import PathwayService
from scripts._db import run_script
from scripts.seed_organisations import ORTHO_DEPT_ORG_ID, ZAS_ROOT_ORG_ID
from scripts.seed_pathway import PATHWAY_ID as RUGREVAL_PATHWAY_ID
from scripts.seed_roles import ADMIN_ROLE_SLUG, DEFAULT_ROLE_SLUG, seed_roles
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_USER_ID, CAREGIVER_EMAIL

logger = logging.getLogger(__name__)

CAMPUS_STUIVENBERG_ORG_ID = UUID("00000000-0000-4000-8000-00000000026a")
CAMPUS_VINCENTIUS_ORG_ID = UUID("00000000-0000-4000-8000-00000000026b")

SPEC_ORTHO_ID = UUID("00000000-0000-4000-8000-00000000027a")
SPEC_PHYSIO_ID = UUID("00000000-0000-4000-8000-00000000027b")
SPEC_CARDIO_ID = UUID("00000000-0000-4000-8000-00000000027c")

HART_PATHWAY_NAME = "Hartrevalidatie"

CAMPUS_DOCTOR_EMAIL = "campusarts@zas.local"
CARDIOLOGIST_EMAIL = "cardioloog@zas.local"
EXTERNAL_GP_EMAIL = "huisarts@extern.be"
MULTI_ROLE_EMAIL = "hoofdarts@zas.local"

_PASSWORD_FALLBACK = "changeme"


def _password_hash(hasher: PasswordHasher) -> str:
    return hasher.hash(os.getenv("BACKEND_SEED_DEMO_PASSWORD") or _PASSWORD_FALLBACK)


async def _get_or_create_user(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    email: str,
    display_name: str,
    role_id: UUID,
    password_hash: str,
) -> User:
    existing = await session.scalar(
        select(User).where(
            User.tenant_id == tenant_id,
            User.email == email,
            User.role_id == role_id,
            User.deleted_at.is_(None),
        )
    )
    if existing is not None:
        return existing
    user = User(
        tenant_id=tenant_id,
        email=email,
        display_name=display_name,
        role_id=role_id,
        is_active=True,
        password_hash=password_hash,
    )
    session.add(user)
    await session.flush()
    logger.info("seeded user email=%s role_id=%s", email, role_id)
    return user


async def _get_or_create_practitioner_role(
    session: AsyncSession,
    *,
    user: User,
    given_name: str,
    family_name: str,
    organisation_id: UUID,
    code: PractitionerRoleCode,
) -> PractitionerRole:
    practitioner = await session.scalar(
        select(Practitioner).where(
            Practitioner.user_id == user.id, Practitioner.deleted_at.is_(None)
        )
    )
    if practitioner is None:
        practitioner = Practitioner(user_id=user.id, given_name=given_name, family_name=family_name)
        session.add(practitioner)
        await session.flush()
    role = await session.scalar(
        select(PractitionerRole).where(
            PractitionerRole.practitioner_id == practitioner.id,
            PractitionerRole.organisation_id == organisation_id,
            PractitionerRole.period_end.is_(None),
            PractitionerRole.deleted_at.is_(None),
        )
    )
    if role is None:
        role = PractitionerRole(
            practitioner_id=practitioner.id,
            organisation_id=organisation_id,
            code=code,
            is_primary=False,
        )
        session.add(role)
        await session.flush()
    return role


async def _link_role_specialism(
    session: AsyncSession, *, role_id: UUID, specialism_id: UUID
) -> None:
    existing = await session.scalar(
        select(PractitionerRoleSpecialism.id).where(
            PractitionerRoleSpecialism.practitioner_role_id == role_id,
            PractitionerRoleSpecialism.specialism_id == specialism_id,
            PractitionerRoleSpecialism.deleted_at.is_(None),
        )
    )
    if existing is None:
        session.add(
            PractitionerRoleSpecialism(practitioner_role_id=role_id, specialism_id=specialism_id)
        )
        await session.flush()


async def _get_or_create_specialism(
    session: AsyncSession, *, specialism_id: UUID, tenant_id: UUID, code: str, display: str
) -> Specialism:
    existing = await session.get(Specialism, specialism_id)
    if existing is not None:
        return existing
    specialism = Specialism(id=specialism_id, code=code, display=display)
    session.add(specialism)
    await session.flush()
    return specialism


async def _get_or_create_campus(
    session: AsyncSession, *, org_id: UUID, tenant_id: UUID, name: str
) -> Organisation:
    existing = await session.get(Organisation, org_id)
    if existing is not None:
        return existing
    campus = Organisation(
        id=org_id,
        name=name,
        type_code=OrganisationTypeCode.PROVIDER,
        type_display="Hospital campus",
        parent_organisation_id=ZAS_ROOT_ORG_ID,
    )
    session.add(campus)
    await session.flush()
    logger.info("seeded campus organisation %s", name)
    return campus


async def seed_access_entitlements(session: AsyncSession) -> None:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise RuntimeError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")
    user_repo = UserRepository(session)
    admin = await user_repo.get_by_id(ADMIN_USER_ID)
    if admin is None:
        raise RuntimeError("bootstrap admin missing — run seed_users first")
    roles = await seed_roles(session, tenant_id=tenant.id)
    admin_role_id = roles[ADMIN_ROLE_SLUG].id
    default_role_id = roles[DEFAULT_ROLE_SLUG].id
    hasher = PasswordHasher()
    demo_hash = _password_hash(hasher)

    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = await build_session_user(session, admin)
    try:
        # ── 8.1 campuses + specialisms + role links ─────────────────────
        stuivenberg = await _get_or_create_campus(
            session,
            org_id=CAMPUS_STUIVENBERG_ORG_ID,
            tenant_id=tenant.id,
            name="Campus Stuivenberg",
        )
        await _get_or_create_campus(
            session,
            org_id=CAMPUS_VINCENTIUS_ORG_ID,
            tenant_id=tenant.id,
            name="Campus Sint-Vincentius",
        )
        # Orthopedie moves under Campus Stuivenberg: root → campus → dept
        ortho = await session.get(Organisation, ORTHO_DEPT_ORG_ID)
        if ortho is not None and ortho.parent_organisation_id == ZAS_ROOT_ORG_ID:
            ortho.parent_organisation_id = stuivenberg.id
            await session.flush()
            logger.info("re-parented Orthopedie under Campus Stuivenberg")

        spec_ortho = await _get_or_create_specialism(
            session,
            specialism_id=SPEC_ORTHO_ID,
            tenant_id=tenant.id,
            code="orthopedics",
            display="Orthopedie",
        )
        spec_physio = await _get_or_create_specialism(
            session,
            specialism_id=SPEC_PHYSIO_ID,
            tenant_id=tenant.id,
            code="physiotherapy",
            display="Kinesitherapie",
        )
        spec_cardio = await _get_or_create_specialism(
            session,
            specialism_id=SPEC_CARDIO_ID,
            tenant_id=tenant.id,
            code="cardiology",
            display="Cardiologie",
        )

        # demo caregiver: MULTI-specialism (REQ-FUN-28)
        caregiver = await user_repo.get_by_email(
            tenant.id, CAREGIVER_EMAIL, role_id=default_role_id
        )
        if caregiver is None:
            raise RuntimeError("demo caregiver missing — run seed_users first")
        caregiver_role = await session.scalar(
            select(PractitionerRole)
            .join(Practitioner, Practitioner.id == PractitionerRole.practitioner_id)
            .where(
                Practitioner.user_id == caregiver.id,
                PractitionerRole.period_end.is_(None),
                PractitionerRole.deleted_at.is_(None),
            )
            .limit(1)
        )
        if caregiver_role is not None:
            await _link_role_specialism(
                session, role_id=caregiver_role.id, specialism_id=spec_ortho.id
            )
            await _link_role_specialism(
                session, role_id=caregiver_role.id, specialism_id=spec_physio.id
            )

        # campus-level physician (REQ-NON-15): role at the campus org covers
        # every descendant treating organisation
        campus_doctor = await _get_or_create_user(
            session,
            tenant_id=tenant.id,
            email=CAMPUS_DOCTOR_EMAIL,
            display_name="Karel Campusarts",
            role_id=default_role_id,
            password_hash=demo_hash,
        )
        campus_role = await _get_or_create_practitioner_role(
            session,
            user=campus_doctor,
            given_name="Karel",
            family_name="Campusarts",
            organisation_id=stuivenberg.id,
            code=PractitionerRoleCode.PHYSICIAN,
        )
        await _link_role_specialism(session, role_id=campus_role.id, specialism_id=spec_ortho.id)

        # cardiologist for the explicit-assignment demo
        cardiologist = await _get_or_create_user(
            session,
            tenant_id=tenant.id,
            email=CARDIOLOGIST_EMAIL,
            display_name="Carla Cardioloog",
            role_id=default_role_id,
            password_hash=demo_hash,
        )
        cardio_role = await _get_or_create_practitioner_role(
            session,
            user=cardiologist,
            given_name="Carla",
            family_name="Cardioloog",
            organisation_id=stuivenberg.id,
            code=PractitionerRoleCode.PHYSICIAN,
        )
        await _link_role_specialism(session, role_id=cardio_role.id, specialism_id=spec_cardio.id)

        # ── 8.2 carepath links ──────────────────────────────────────────
        async def _link_pathway_specialism(pathway_id: UUID, specialism_id: UUID) -> None:
            existing = await session.scalar(
                select(PathwaySpecialism.id).where(
                    PathwaySpecialism.pathway_id == pathway_id,
                    PathwaySpecialism.specialism_id == specialism_id,
                    PathwaySpecialism.deleted_at.is_(None),
                )
            )
            if existing is None:
                session.add(PathwaySpecialism(pathway_id=pathway_id, specialism_id=specialism_id))
                await session.flush()

        rugreval = await session.get(Pathway, RUGREVAL_PATHWAY_ID)
        if rugreval is not None:
            await _link_pathway_specialism(rugreval.id, spec_ortho.id)

        hart = await session.scalar(
            select(Pathway).where(
                Pathway.tenant_id == tenant.id,
                Pathway.name == HART_PATHWAY_NAME,
                Pathway.deleted_at.is_(None),
            )
        )
        if hart is None:
            service = PathwayService(PathwayRepository(session), PathwayVersionRepository(session))
            created = await service.create_empty(
                tenant.id,
                HART_PATHWAY_NAME,
                clinical_goal="Hartrevalidatie na cardiale ingreep (demo).",
                patient_goal="Veilig conditie heropbouwen (demo).",
            )
            hart = await session.get(Pathway, created.pathway.id)
            assert hart is not None
        await _link_pathway_specialism(hart.id, spec_cardio.id)
        # explicit assignment narrows cardiology-wide access to Carla alone
        assigned = await session.scalar(
            select(PathwayPractitioner.id).where(
                PathwayPractitioner.pathway_id == hart.id,
                PathwayPractitioner.user_id == cardiologist.id,
                PathwayPractitioner.deleted_at.is_(None),
            )
        )
        if assigned is None:
            session.add(PathwayPractitioner(pathway_id=hart.id, user_id=cardiologist.id))
            await session.flush()

        # ── 8.3 external GP + consent + grant + shielding rules ────────
        external_gp = await _get_or_create_user(
            session,
            tenant_id=tenant.id,
            email=EXTERNAL_GP_EMAIL,
            display_name="Greet Huisarts",
            role_id=default_role_id,  # platform role; externality = no org-tree role
            password_hash=demo_hash,
        )
        profile = await session.scalar(
            select(ExternalAccessProfile).where(
                ExternalAccessProfile.tenant_id == tenant.id,
                ExternalAccessProfile.professional_type == PractitionerRoleCode.GP,
                ExternalAccessProfile.deleted_at.is_(None),
            )
        )
        if profile is None:
            session.add(
                ExternalAccessProfile(
                    professional_type=PractitionerRoleCode.GP,
                    allow_read=True,
                    allow_record=True,
                    allow_write=False,
                    allow_message=False,
                )
            )
            await session.flush()
        first_patient = await session.scalar(
            select(Patient)
            .where(Patient.tenant_id == tenant.id, Patient.deleted_at.is_(None))
            .order_by(Patient.created_at)
            .limit(1)
        )
        if first_patient is not None:
            grant = await session.scalar(
                select(ExternalGrant).where(
                    ExternalGrant.patient_id == first_patient.id,
                    ExternalGrant.user_id == external_gp.id,
                    ExternalGrant.period_end.is_(None),
                    ExternalGrant.deleted_at.is_(None),
                )
            )
            if grant is None:
                consent = Consent(patient_id=first_patient.id, scope="external_collaboration")
                session.add(consent)
                await session.flush()
                session.add(
                    ExternalGrant(
                        patient_id=first_patient.id,
                        user_id=external_gp.id,
                        professional_type=PractitionerRoleCode.GP,
                        consent_id=consent.id,
                    )
                )
                await session.flush()

        # shielding: release parameters to external professionals; diary has
        # NO rule on purpose — the default-deny demo case (REQ-FUN-161)
        rule = await session.scalar(
            select(ShieldingRule).where(
                ShieldingRule.tenant_id == tenant.id,
                ShieldingRule.pathway_id.is_(None),
                ShieldingRule.item_category == ItemCategory.PARAMETERS,
                ShieldingRule.audience == ShieldingAudience.EXTERNAL_PROFESSIONAL,
                ShieldingRule.deleted_at.is_(None),
            )
        )
        if rule is None:
            session.add(
                ShieldingRule(
                    item_category=ItemCategory.PARAMETERS,
                    audience=ShieldingAudience.EXTERNAL_PROFESSIONAL,
                    released=True,
                )
            )
            await session.flush()

        # ── 8.4 multi-role human ────────────────────────────────────────
        multi_caregiver = await _get_or_create_user(
            session,
            tenant_id=tenant.id,
            email=MULTI_ROLE_EMAIL,
            display_name="Hilde Hoofdarts",
            role_id=default_role_id,
            password_hash=demo_hash,
        )
        await _get_or_create_user(
            session,
            tenant_id=tenant.id,
            email=MULTI_ROLE_EMAIL,
            display_name="Hilde Hoofdarts",
            role_id=admin_role_id,
            password_hash=demo_hash,
        )
        multi_role = await _get_or_create_practitioner_role(
            session,
            user=multi_caregiver,
            given_name="Hilde",
            family_name="Hoofdarts",
            organisation_id=ORTHO_DEPT_ORG_ID,
            code=PractitionerRoleCode.PHYSICIAN,
        )
        await _link_role_specialism(session, role_id=multi_role.id, specialism_id=spec_ortho.id)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    logger.info("access-entitlements demo data seeded")


async def _run(session: AsyncSession) -> None:
    await seed_access_entitlements(session)


def main() -> None:
    run_script(_run)


if __name__ == "__main__":
    main()
