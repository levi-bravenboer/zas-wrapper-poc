# POC ONLY — bootstrap seed; replace before non-PoC deployment.
#
# Seeds a representative "Rugrevalidatie" pathway under the `zas` tenant so
# Phase-3 prototyping always has graph content to render. Idempotent: if a
# pathway with the same name already exists for the tenant, the seed is a
# no-op. UUIDs are static so subsequent reseeds keep the same identifiers.

"""Idempotent seed of the Rugrevalidatie demo pathway.

Run: `python -m scripts.seed_pathway` (or `python scripts/seed_pathway.py`).
"""

from __future__ import annotations

import logging
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.pathway import Pathway, PathwayLaneKind, PathwayVersion
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.pathway.pathway import (
    PathwayBlockBranchIn,
    PathwayBlockIn,
    PathwayDefinitionReplace,
    PathwayLaneIn,
    PathwayPhaseIn,
    PathwayPublishRequest,
)
from app.domain.pathway import (
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
    SEEDED_LANE_KINDS,
)
from app.services.pathway.pathway_service import PathwayService
from app.services.pathway.pathway_version_service import PathwayVersionService
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL

logger = logging.getLogger(__name__)

PATHWAY_ID: UUID = UUID("00000000-0000-4000-8000-00000000beef")
PATHWAY_NAME = "Rugrevalidatie"

PHASE_PRE_OP_ID: UUID = UUID("00000000-0000-4000-8000-000000000101")
PHASE_SURGERY_ID: UUID = UUID("00000000-0000-4000-8000-000000000102")
PHASE_RECOVERY_ID: UUID = UUID("00000000-0000-4000-8000-000000000103")
PHASE_FOLLOW_UP_ID: UUID = UUID("00000000-0000-4000-8000-000000000104")

LANE_PATIENT_ID: UUID = UUID("00000000-0000-4000-8000-000000000201")
LANE_CAREGIVER_ID: UUID = UUID("00000000-0000-4000-8000-000000000202")
LANE_SYSTEM_ID: UUID = UUID("00000000-0000-4000-8000-000000000203")
LANE_EXTERNAL_ID: UUID = UUID("00000000-0000-4000-8000-000000000204")

BLOCK_INTAKE_ID: UUID = UUID("00000000-0000-4000-8000-000000000301")
BLOCK_OPERATIE_ID: UUID = UUID("00000000-0000-4000-8000-000000000302")
BLOCK_HERSTEL_ID: UUID = UUID("00000000-0000-4000-8000-000000000303")
BLOCK_VOORTGANG_ID: UUID = UUID("00000000-0000-4000-8000-000000000304")
BLOCK_ONTSLAG_ID: UUID = UUID("00000000-0000-4000-8000-000000000305")
BLOCK_CONTROLE_ID: UUID = UUID("00000000-0000-4000-8000-000000000306")

BRANCH_GOED_ID: UUID = UUID("00000000-0000-4000-8000-000000000401")
BRANCH_SLECHT_ID: UUID = UUID("00000000-0000-4000-8000-000000000402")

# Edge constants removed in slot #2 §3 — the demo seed no longer
# materialises edge rows.


def _build_payload() -> PathwayDefinitionReplace:
    return PathwayDefinitionReplace(
        name=PATHWAY_NAME,
        clinical_goal=(
            "Restore pain-free lumbar mobility and return patient to "
            "pre-op function within 12 weeks."
        ),
        patient_goal=("Walk my daughter down the aisle without back pain in three months."),
        phases=[
            PathwayPhaseIn(id=PHASE_PRE_OP_ID, template_id="pre-op", label="Pre-op", ord=10),
            PathwayPhaseIn(id=PHASE_SURGERY_ID, template_id="surgery", label="Surgery", ord=20),
            PathwayPhaseIn(id=PHASE_RECOVERY_ID, template_id="recovery", label="Recovery", ord=30),
            PathwayPhaseIn(
                id=PHASE_FOLLOW_UP_ID, template_id="follow-up", label="Follow-up", ord=40
            ),
        ],
        lanes=[
            PathwayLaneIn(
                id=LANE_PATIENT_ID,
                lane_kind_code=LANE_KIND_PATIENT,
                label="Patient",
                ord=10,
                is_default=True,
            ),
            PathwayLaneIn(
                id=LANE_CAREGIVER_ID,
                lane_kind_code=LANE_KIND_CAREGIVER,
                label="Caregiver",
                ord=20,
            ),
            PathwayLaneIn(
                id=LANE_SYSTEM_ID,
                lane_kind_code=LANE_KIND_SYSTEM,
                label="System",
                ord=30,
            ),
            PathwayLaneIn(
                id=LANE_EXTERNAL_ID,
                lane_kind_code=LANE_KIND_EXTERNAL,
                label="External",
                ord=40,
            ),
        ],
        blocks=[
            PathwayBlockIn(
                id=BLOCK_INTAKE_ID,
                phase_id=PHASE_PRE_OP_ID,
                lane_id=LANE_CAREGIVER_ID,
                type="appointment",
                label="Intake gesprek",
                config={
                    "title": "Intake gesprek",
                    "location": "ZAS Antwerpen, polikliniek",
                    "duration_minutes": 30,
                },
                x=0,
                y=0,
            ),
            PathwayBlockIn(
                id=BLOCK_OPERATIE_ID,
                phase_id=PHASE_SURGERY_ID,
                lane_id=LANE_SYSTEM_ID,
                type="milestone",
                label="Operatie",
                config={"label": "Operatie"},
                x=240,
                y=0,
            ),
            PathwayBlockIn(
                id=BLOCK_HERSTEL_ID,
                phase_id=PHASE_RECOVERY_ID,
                lane_id=LANE_SYSTEM_ID,
                type="wait",
                label="Thuisrevalidatie periode",
                config={
                    "event_type": "external_data",
                    "timeout_days": 42,
                    "on_timeout": "continue",
                },
                x=480,
                y=0,
            ),
            PathwayBlockIn(
                id=BLOCK_VOORTGANG_ID,
                phase_id=PHASE_FOLLOW_UP_ID,
                lane_id=LANE_SYSTEM_ID,
                type="decision",
                label="Voortgangsmeting",
                # Slot #2 §5: typed `outputs` declared so the decision
                # publishes; legacy demo pathway used edge branches
                # (`Goed`/`Onvoldoende`) which the §3 backfill rewrites
                # into `decision_output` rules referencing these keys.
                config={
                    "question": "Verloopt het herstel volgens plan?",
                    "outputs": ["goed", "onvoldoende"],
                    "mode": "xor",
                },
                x=720,
                y=0,
            ),
            PathwayBlockIn(
                id=BLOCK_ONTSLAG_ID,
                phase_id=PHASE_FOLLOW_UP_ID,
                lane_id=LANE_SYSTEM_ID,
                type="milestone",
                label="Ontslag",
                config={"label": "Ontslag"},
                x=960,
                y=-80,
            ),
            PathwayBlockIn(
                id=BLOCK_CONTROLE_ID,
                phase_id=PHASE_FOLLOW_UP_ID,
                lane_id=LANE_CAREGIVER_ID,
                type="appointment",
                label="Extra controle",
                config={"title": "Extra controle", "duration_minutes": 20},
                x=960,
                y=80,
            ),
        ],
        branches=[
            PathwayBlockBranchIn(
                id=BRANCH_GOED_ID, block_id=BLOCK_VOORTGANG_ID, label="Goed", ord=0
            ),
            PathwayBlockBranchIn(
                id=BRANCH_SLECHT_ID, block_id=BLOCK_VOORTGANG_ID, label="Onvoldoende", ord=1
            ),
        ],
        # Edges retired in slot #2 §3 — connectivity should now be
        # authored as `input_logic` rules on each target block's
        # config bag. The demo seed will be retypeset in slot #2 §7;
        # for the migration interim this pathway materialises with
        # disconnected blocks. The alembic backfill is the canonical
        # path for existing production rows (one-shot edge → rule
        # rewrite) and is exercised in the §7 backfill round-trip
        # test rather than here.
    )


async def seed_rugrevalidatie(session: AsyncSession) -> Pathway:
    """Insert the Rugrevalidatie demo pathway if missing. Idempotent."""

    tenant_repo = TenantRepository(session)
    tenant = await tenant_repo.get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise RuntimeError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    user_repo = UserRepository(session)
    admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
    if admin is None:
        raise RuntimeError(f"{ADMIN_EMAIL} user missing — run seed_users first")

    existing = await session.scalar(select(Pathway).where(Pathway.id == PATHWAY_ID))
    if existing is not None:
        logger.info("pathway id=%s already present", PATHWAY_ID)
        return existing

    actor = SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )
    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = actor
    try:
        pathway = Pathway(
            id=PATHWAY_ID,
            name=PATHWAY_NAME,
            clinical_goal=(
                "Restore pain-free lumbar mobility and return patient to "
                "pre-op function within 12 weeks."
            ),
            patient_goal=("Walk my daughter down the aisle without back pain in three months."),
        )
        session.add(pathway)
        await session.flush()

        initial_version = PathwayVersion(
            pathway_id=PATHWAY_ID,
            version_no=1,
            status="concept",
            kind="initial",
        )
        session.add(initial_version)
        await session.flush()

        repo = PathwayRepository(session)
        version_repo = PathwayVersionRepository(session)
        service = PathwayService(repo, version_repo)
        await service.replace_definition(
            pathway_id=PATHWAY_ID,
            tenant_id=tenant.id,
            payload=_build_payload(),
        )

        # Promote v1 to published, then restore as v2 concept so the seed
        # ships with both a published baseline and a current concept — gives
        # the orchestrator version surface real rows to bind against per
        # `openspec/changes/pathway-builder-base/tasks.md` 4.24.
        version_service = PathwayVersionService(repo, version_repo)
        await version_service.publish(
            pathway_id=PATHWAY_ID,
            tenant_id=tenant.id,
            payload=PathwayPublishRequest(
                label="Initiële publicatie",
                note="Geseed met de Rugrevalidatie-bootstrap.",
                clinically_approved=True,
            ),
            actor_id=admin.id,
        )
        published_v1 = await version_repo.get_latest_published(PATHWAY_ID)
        if published_v1 is not None:
            await version_service.restore(
                pathway_id=PATHWAY_ID,
                source_version_id=published_v1.id,
                tenant_id=tenant.id,
            )
        logger.info("seeded pathway id=%s name=%s", PATHWAY_ID, PATHWAY_NAME)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return pathway


async def seed_lane_kinds(session: AsyncSession) -> None:
    """Insert the four canonical lane kinds if missing. Idempotent.

    The Alembic migration also seeds these via `op.execute`, so on a
    real Postgres they already exist. This helper covers the test path
    where the schema is rebuilt via `Base.metadata.create_all` (which
    skips migration `op.execute` blocks) and any environment where the
    seed needs to be re-applied.
    """

    existing_codes = set((await session.scalars(select(PathwayLaneKind.code))).all())
    missing = [(code, label) for code, label in SEEDED_LANE_KINDS if code not in existing_codes]
    if not missing:
        return
    session.add_all(
        [PathwayLaneKind(id=uuid4(), code=code, label=label) for code, label in missing]
    )
    await session.flush()
    logger.info("seeded lane kinds codes=%s", [code for code, _ in missing])


async def _seed(session: AsyncSession) -> None:
    await seed_lane_kinds(session)
    await seed_rugrevalidatie(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
