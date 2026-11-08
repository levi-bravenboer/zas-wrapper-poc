# POC ONLY — bootstrap seed; replace before non-PoC deployment.
#
# English-language twin of the bladder-cancer v2 pathway, for demoing the
# orchestrator's English UI with English pathway content. Same graph as v2
# (post-operative wound check is a caregiver task); every author-facing and
# patient-facing string is English.

"""Idempotent seed of the English bladder-cancer demo pathway."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import SpecialtyCode
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.pathway import Pathway, PathwayVersion
from app.domain.pathway import (
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
)
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.pathway.pathway import (
    PathwayBlockIn,
    PathwayDefinitionReplace,
    PathwayLaneIn,
    PathwayPhaseIn,
    PathwayPublishRequest,
)
from app.services.access.rbac.resolver import build_session_user
from app.services.pathway.pathway_service import PathwayService
from app.services.pathway.pathway_version_service import PathwayVersionService
from scripts._db import run_script
from scripts.seed_bladder_cancer_v2 import _gate_decision, _gate_if_done
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL

logger = logging.getLogger(__name__)

# Own UUID namespace (`0bce` suffix) so it coexists with the Dutch v1 / v2.
PATHWAY_ID: UUID = UUID("00000000-0000-4000-8000-0000000bce00")
PATHWAY_NAME = "Bladder cancer (urology)"
CLINICAL_GOAL = "Diagnose and treat bladder cancer; hand stable patients over to oncology."
PATIENT_GOAL = "Understand my diagnosis and get the right treatment without delay."


def _u(suffix: str) -> UUID:
    return UUID(f"00000000-0000-4000-8000-0000000bce{suffix}")


PHASE_DIAG_ID = _u("10")
PHASE_PREOP_ID = _u("11")
PHASE_SURGERY_ID = _u("12")
PHASE_FOLLOWUP_ID = _u("13")

LANE_PATIENT_ID = _u("20")
LANE_CAREGIVER_ID = _u("21")
LANE_SYSTEM_ID = _u("22")
LANE_EXTERNAL_ID = _u("23")

B_START = _u("30")
B_LUSCII = _u("31")
B_SCAN = _u("32")
B_REVIEW_SCAN = _u("33")
B_MDO_DIAG = _u("34")
B_DISCUSS1 = _u("35")
B_DECIDE_OP = _u("36")
B_END_DONOTHING = _u("37")
B_LAB = _u("38")
B_DECIDE_LAB = _u("39")
B_END_ABORT = _u("3a")
B_PREOP_MSG = _u("3b")
B_REVIEW_LUSCII = _u("3c")
B_OPERATION = _u("3d")
B_POSTOP_MSG = _u("3e")
B_PATHOLOGY = _u("3f")
B_MDO_POSTOP = _u("40")
B_WOUND_CHECK = _u("41")
B_DECIDE_TREAT = _u("42")
B_END_TREAT = _u("43")
B_END_NOTHING = _u("44")

_UROLOGY = {"role": "physician", "specialty": SpecialtyCode.UROLOGIE.value}
_ANY_CAREGIVER = {"role": "caregiver"}

_WOUND_CHECK_NOTES = (
    "Check the wound for signs of infection (redness, swelling, leakage). "
    "Take a photo of the wound and add it to the patient notes. "
    "Measure the blood pressure and record the values via 'Add measurement' on this task. "
    "Discuss any abnormal findings with the treating urologist straight away."
)

_PREOP_BODY = (
    "Your operation is coming up. Please do not eat for 6 hours beforehand, "
    "bring your medication list, and arrange for someone to take you home afterwards."
)

_POSTOP_BODY = (
    "Welcome home. Drink plenty of water, avoid heavy lifting for two weeks, "
    "and contact the ward if you have a fever, heavy bleeding or cannot pass urine."
)


def _build_payload() -> PathwayDefinitionReplace:
    return PathwayDefinitionReplace(
        name=PATHWAY_NAME,
        clinical_goal=CLINICAL_GOAL,
        patient_goal=PATIENT_GOAL,
        phases=[
            PathwayPhaseIn(id=PHASE_DIAG_ID, template_id="pre-op", label="Diagnostics", ord=10),
            PathwayPhaseIn(id=PHASE_PREOP_ID, template_id="pre-op", label="Pre-operative", ord=20),
            PathwayPhaseIn(id=PHASE_SURGERY_ID, template_id="surgery", label="Surgery", ord=30),
            PathwayPhaseIn(
                id=PHASE_FOLLOWUP_ID, template_id="follow-up", label="Follow-up", ord=40
            ),
        ],
        lanes=[
            PathwayLaneIn(
                id=LANE_PATIENT_ID, lane_kind_code=LANE_KIND_PATIENT, label="Patient", ord=0
            ),
            PathwayLaneIn(
                id=LANE_CAREGIVER_ID,
                lane_kind_code=LANE_KIND_CAREGIVER,
                label="Care team",
                ord=1,
            ),
            PathwayLaneIn(
                id=LANE_SYSTEM_ID, lane_kind_code=LANE_KIND_SYSTEM, label="System", ord=2
            ),
            PathwayLaneIn(
                id=LANE_EXTERNAL_ID, lane_kind_code=LANE_KIND_EXTERNAL, label="External", ord=3
            ),
        ],
        blocks=[
            PathwayBlockIn(
                id=B_START,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="start",
                label="Patient enrolled",
                config={"name": "Start"},
            ),
            PathwayBlockIn(
                id=B_LUSCII,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_EXTERNAL_ID,
                kind="luscii.program",
                label="Luscii remote monitoring",
                config={"program_id": "luscii-bladder-poc", "input_logic": _gate_if_done(B_START)},
            ),
            PathwayBlockIn(
                id=B_SCAN,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="appointment",
                label="Appointment: CT scan",
                config={
                    "title": "CT scan",
                    "location": "Radiology",
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_LUSCII),
                },
            ),
            PathwayBlockIn(
                id=B_REVIEW_SCAN,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="task",
                label="Task: review scan",
                config={
                    "title": "Review CT scan",
                    "assignee": "caregiver",
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_SCAN),
                },
            ),
            PathwayBlockIn(
                id=B_MDO_DIAG,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="mdo",
                label="MDT (diagnostic)",
                config={
                    "topic": "Diagnostic MDT",
                    "outcomes": ["operate", "do_nothing"],
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_REVIEW_SCAN),
                },
            ),
            PathwayBlockIn(
                id=B_DISCUSS1,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="appointment",
                label="Appointment: discuss results",
                config={
                    "title": "Discuss results",
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_MDO_DIAG),
                },
            ),
            PathwayBlockIn(
                id=B_DECIDE_OP,
                phase_id=PHASE_DIAG_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="decision",
                label="Decision: operate?",
                config={
                    "question": "Operate?",
                    "outputs": ["operate", "do_nothing"],
                    "mode": "xor",
                    "input_logic": _gate_if_done(B_DISCUSS1),
                },
            ),
            PathwayBlockIn(
                id=B_END_DONOTHING,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="end_pathway",
                label="End (no surgery)",
                config={"name": "End", "input_logic": _gate_decision(B_DECIDE_OP, "do_nothing")},
            ),
            PathwayBlockIn(
                id=B_LAB,
                phase_id=PHASE_PREOP_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="appointment",
                label="Appointment: blood test",
                config={
                    "title": "Pre-operative blood test",
                    "location": "Laboratory",
                    "participant": _UROLOGY,
                    "input_logic": _gate_decision(B_DECIDE_OP, "operate"),
                },
            ),
            PathwayBlockIn(
                id=B_DECIDE_LAB,
                phase_id=PHASE_PREOP_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="decision",
                label="Decision: lab results",
                config={
                    "question": "Proceed with surgery?",
                    "outputs": ["proceed", "abort"],
                    "mode": "xor",
                    "input_logic": _gate_if_done(B_LAB),
                },
            ),
            PathwayBlockIn(
                id=B_END_ABORT,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="end_pathway",
                label="End (cancelled)",
                config={"name": "End", "input_logic": _gate_decision(B_DECIDE_LAB, "abort")},
            ),
            PathwayBlockIn(
                id=B_PREOP_MSG,
                phase_id=PHASE_PREOP_ID,
                lane_id=LANE_PATIENT_ID,
                kind="message",
                label="Pre-operative information",
                config={
                    "channel": "email",
                    "subject": "Your operation is coming up",
                    "body": _PREOP_BODY,
                    "input_logic": _gate_decision(B_DECIDE_LAB, "proceed"),
                    "timing_policy": {
                        "kind": "relative_to_date",
                        "date_name": "operation_date",
                        "offset_iso": "P3D",
                        "direction": "before",
                    },
                },
            ),
            PathwayBlockIn(
                id=B_REVIEW_LUSCII,
                phase_id=PHASE_PREOP_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="task",
                label="Task: review Luscii pre-op data",
                config={
                    "title": "Review Luscii pre-op data",
                    "assignee": "caregiver",
                    "participant": _UROLOGY,
                    "input_logic": _gate_decision(B_DECIDE_LAB, "proceed"),
                },
            ),
            PathwayBlockIn(
                id=B_OPERATION,
                phase_id=PHASE_SURGERY_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="treatment",
                label="Surgery",
                config={
                    "title": "Surgery (TURBT)",
                    "location": "Operating room",
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_PREOP_MSG, B_REVIEW_LUSCII),
                    "timing_policy": {
                        "kind": "relative_to_date",
                        "date_name": "operation_date",
                        "offset_iso": "PT0S",
                        "direction": "after",
                    },
                },
            ),
            PathwayBlockIn(
                id=B_POSTOP_MSG,
                phase_id=PHASE_SURGERY_ID,
                lane_id=LANE_PATIENT_ID,
                kind="message",
                label="Post-operative information",
                config={
                    "channel": "email",
                    "subject": "After your operation",
                    "body": _POSTOP_BODY,
                    "input_logic": _gate_if_done(B_OPERATION),
                },
            ),
            PathwayBlockIn(
                id=B_PATHOLOGY,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="task",
                label="Task: review pathology report",
                config={
                    "title": "Review pathology report",
                    "assignee": "caregiver",
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_OPERATION),
                },
            ),
            PathwayBlockIn(
                id=B_MDO_POSTOP,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="mdo",
                label="MDT (post-operative)",
                config={
                    "topic": "Post-operative MDT",
                    "outcomes": ["treatment", "nothing"],
                    "participant": _UROLOGY,
                    "input_logic": _gate_if_done(B_PATHOLOGY),
                },
            ),
            PathwayBlockIn(
                id=B_WOUND_CHECK,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_CAREGIVER_ID,
                kind="task",
                label="Task: wound check + blood pressure",
                config={
                    "title": "Wound check: photo of wound + measure blood pressure",
                    "assignee": "caregiver",
                    "participant": _ANY_CAREGIVER,
                    "notes": _WOUND_CHECK_NOTES,
                    "requires_completion": True,
                    "input_logic": _gate_if_done(B_OPERATION),
                },
            ),
            PathwayBlockIn(
                id=B_DECIDE_TREAT,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="decision",
                label="Decision: further treatment?",
                config={
                    "question": "Further treatment needed?",
                    "outputs": ["treatment", "nothing"],
                    "mode": "xor",
                    "input_logic": _gate_if_done(B_MDO_POSTOP),
                },
            ),
            PathwayBlockIn(
                id=B_END_TREAT,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="end_pathway",
                label="End → oncology",
                config={
                    "name": "End",
                    "input_logic": _gate_decision(B_DECIDE_TREAT, "treatment"),
                },
            ),
            PathwayBlockIn(
                id=B_END_NOTHING,
                phase_id=PHASE_FOLLOWUP_ID,
                lane_id=LANE_SYSTEM_ID,
                kind="end_pathway",
                label="End (no further treatment)",
                config={"name": "End", "input_logic": _gate_decision(B_DECIDE_TREAT, "nothing")},
            ),
        ],
    )


async def seed_bladder_cancer_en(session: AsyncSession) -> Pathway:
    """Insert the English bladder-cancer demo pathway if missing. Idempotent."""
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise RuntimeError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")
    admin = await UserRepository(session).get_by_email(tenant.id, ADMIN_EMAIL)
    if admin is None:
        raise RuntimeError(f"{ADMIN_EMAIL} user missing — run seed_users first")

    existing = await session.scalar(select(Pathway).where(Pathway.id == PATHWAY_ID))
    if existing is not None:
        logger.info("pathway id=%s already present", PATHWAY_ID)
        return existing

    actor = await build_session_user(session, admin)
    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = actor
    try:
        pathway = Pathway(
            id=PATHWAY_ID,
            name=PATHWAY_NAME,
            clinical_goal=CLINICAL_GOAL,
            patient_goal=PATIENT_GOAL,
        )
        session.add(pathway)
        await session.flush()
        session.add(
            PathwayVersion(pathway_id=PATHWAY_ID, version_no=1, status="concept", kind="initial")
        )
        await session.flush()

        repo = PathwayRepository(session)
        version_repo = PathwayVersionRepository(session)
        await PathwayService(repo, version_repo).replace_definition(
            pathway_id=PATHWAY_ID, tenant_id=tenant.id, payload=_build_payload()
        )
        version_service = PathwayVersionService(repo, version_repo)
        await version_service.publish(
            pathway_id=PATHWAY_ID,
            tenant_id=tenant.id,
            payload=PathwayPublishRequest(
                label="Initial publication",
                note="Seeded by the English bladder-cancer bootstrap.",
                clinically_approved=True,
            ),
            actor_id=admin.id,
        )
        published = await version_repo.get_latest_published(PATHWAY_ID)
        if published is not None:
            await version_service.restore(
                pathway_id=PATHWAY_ID, source_version_id=published.id, tenant_id=tenant.id
            )
        logger.info("seeded pathway id=%s name=%s", PATHWAY_ID, PATHWAY_NAME)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor
    return pathway


async def _seed(session: AsyncSession) -> None:
    await seed_bladder_cancer_en(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()


__all__ = ["PATHWAY_ID", "PATHWAY_NAME", "seed_bladder_cancer_en"]
