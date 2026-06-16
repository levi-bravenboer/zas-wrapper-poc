"""Materialise a real `Appointment` from a completed pathway step.

When an `appointment` / `treatment` block completes, the runtime records the
clinical event as a FHIR-aligned `Appointment` (status `fulfilled`) linked
back to the originating step via `pathway_block_instance_id` (pathway-runtime
§3.5). The completing caregiver is attached as the LEAD participant so the
appointment is visible in the appointments surface. Idempotent — a step that
already has an appointment is left untouched.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.db.models.appointment.appointment import Appointment
from app.db.models.appointment.appointment_participant import AppointmentParticipant
from app.db.models.pathway import PathwayBlockExecution, PathwayEnrollment
from app.domain.appointment.validator import (
    AppointmentParticipantSpec,
    AppointmentSpec,
    AppointmentValidator,
)
from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.treatment.typed import TreatmentBlock
from app.schemas.auth.auth import SessionUser

_DEFAULT_DURATION_MIN = 30

_KIND_BY_BLOCK: dict[type[BaseBlock], AppointmentKind] = {
    AppointmentBlock: AppointmentKind.CONSULTATION,
    TreatmentBlock: AppointmentKind.PROCEDURE,
}


def _performed_at(execution: PathwayBlockExecution) -> datetime:
    result = execution.result_json or {}
    raw = result.get("performed_at") if isinstance(result, dict) else None
    if isinstance(raw, str):
        try:
            parsed = datetime.fromisoformat(raw)
            return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
        except ValueError:
            pass
    return execution.completed_at or datetime.now(UTC)


async def materialize_appointment(
    session: AsyncSession,
    *,
    enrollment: PathwayEnrollment,
    execution: PathwayBlockExecution,
    block: BaseBlock,
    actor: SessionUser,
) -> Appointment | None:
    """Create a `fulfilled` Appointment for a completed appointment/treatment
    step, or return `None` when the block is a different kind or one already
    exists for this step."""
    kind = next((k for cls, k in _KIND_BY_BLOCK.items() if isinstance(block, cls)), None)
    if kind is None:
        return None

    existing = await session.scalar(
        select(Appointment.id).where(
            Appointment.pathway_block_instance_id == execution.id,
            Appointment.deleted_at.is_(None),
        )
    )
    if existing is not None:
        return None

    starts_at = _performed_at(execution)
    duration = getattr(block, "duration_minutes", None) or _DEFAULT_DURATION_MIN
    ends_at = starts_at + timedelta(minutes=duration)
    title = getattr(block, "title", None) or block.name
    location = getattr(block, "location", None)
    # `on_site` requires a location_text; fall back to `online` when the block
    # authored no location so the validator stays satisfied.
    modality = AppointmentModality.ON_SITE if location else AppointmentModality.ONLINE

    spec = AppointmentSpec(
        tenant_id=actor.tenant_id,
        patient_id=enrollment.patient_id,
        patient_tenant_id=actor.tenant_id,
        title=title,
        kind=kind,
        starts_at=starts_at,
        ends_at=ends_at,
        modality=modality,
        location_text=location,
        status=AppointmentStatus.FULFILLED,
        participants=(
            AppointmentParticipantSpec(
                user_id=actor.id,
                role=AppointmentParticipantRole.LEAD,
                user_tenant_id=actor.tenant_id,
            ),
        ),
    )
    AppointmentValidator.validate(spec)

    appointment = Appointment(
        id=uuid4(),
        patient_id=enrollment.patient_id,
        pathway_block_instance_id=execution.id,
        title=title,
        kind=kind,
        starts_at=starts_at,
        ends_at=ends_at,
        modality=modality,
        location_text=location,
        status=AppointmentStatus.FULFILLED,
    )
    session.add(appointment)
    await session.flush()
    session.add(
        AppointmentParticipant(
            tenant_id=actor.tenant_id,
            appointment_id=appointment.id,
            user_id=actor.id,
            role=AppointmentParticipantRole.LEAD,
        )
    )
    await session.flush()
    return appointment


__all__ = ["materialize_appointment"]
