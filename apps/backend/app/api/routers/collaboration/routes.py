"""Per-entity nested notes + attachments routes.

Each entity (appointment, task, patient) exposes the same notes/attachments
surface, guarded by THAT entity's access dependency, then delegating to the
shared (authz-free) collaboration services. The route resolves
`(owner_type, owner_id, patient_id)` from the owner and passes it down.

Patient routes are special: GET aggregates ALL items about the patient across
owners; POST creates a `patient`-owned item.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums.collaboration import OwnerType
from app.core.enums.user import Role
from app.db.models.task import Task
from app.schemas.auth.auth import SessionUser
from app.schemas.collaboration.attachment import (
    AttachmentCreate,
    AttachmentDownload,
    AttachmentRead,
    AttachmentUploadResponse,
)
from app.schemas.collaboration.note import NoteCreate, NoteRead
from app.services.access.identity.deps import require_role
from app.services.appointment.deps import AppointmentAccessDep
from app.services.collaboration.deps import AttachmentServiceDep, NoteServiceDep
from app.services.collaboration.errors import OwnerHasNoPatientError
from app.services.patient.deps import PatientAccessDep
from app.services.task.deps import TaskAccessDep

_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))

appointment_collab_router = APIRouter(tags=["appointments"])
task_collab_router = APIRouter(tags=["tasks"])
patient_collab_router = APIRouter(tags=["patients"])


# ── appointment ────────────────────────────────────────────────────────────


@appointment_collab_router.get(
    "/appointments/{appointment_id}/notes", response_model=list[NoteRead]
)
async def list_appointment_notes(
    appointment: AppointmentAccessDep,
    service: NoteServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> list[NoteRead]:
    return await service.list_for_owner(
        tenant_id=current_user.tenant_id, owner_type=OwnerType.APPOINTMENT, owner_id=appointment.id
    )


@appointment_collab_router.post(
    "/appointments/{appointment_id}/notes",
    response_model=NoteRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_appointment_note(
    appointment: AppointmentAccessDep,
    payload: NoteCreate,
    service: NoteServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> NoteRead:
    return await service.add(
        owner_type=OwnerType.APPOINTMENT,
        owner_id=appointment.id,
        patient_id=appointment.patient.id,
        author=current_user,
        body=payload.body,
    )


@appointment_collab_router.get(
    "/appointments/{appointment_id}/attachments", response_model=list[AttachmentRead]
)
async def list_appointment_attachments(
    appointment: AppointmentAccessDep,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> list[AttachmentRead]:
    return await service.list_for_owner(
        tenant_id=current_user.tenant_id, owner_type=OwnerType.APPOINTMENT, owner_id=appointment.id
    )


@appointment_collab_router.post(
    "/appointments/{appointment_id}/attachments",
    response_model=AttachmentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_appointment_attachment(
    appointment: AppointmentAccessDep,
    payload: AttachmentCreate,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> AttachmentUploadResponse:
    return await service.create(
        owner_type=OwnerType.APPOINTMENT,
        owner_id=appointment.id,
        patient_id=appointment.patient.id,
        uploader=current_user,
        filename=payload.filename,
        content_type=payload.content_type,
        size=payload.size,
    )


@appointment_collab_router.get(
    "/appointments/{appointment_id}/attachments/{attachment_id}/url",
    response_model=AttachmentDownload,
)
async def appointment_attachment_url(
    appointment: AppointmentAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> AttachmentDownload:
    return await service.download_url(
        owner_type=OwnerType.APPOINTMENT,
        owner_id=appointment.id,
        attachment_id=attachment_id,
        tenant_id=current_user.tenant_id,
    )


@appointment_collab_router.delete(
    "/appointments/{appointment_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_appointment_attachment(
    appointment: AppointmentAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> None:
    await service.delete(
        owner_type=OwnerType.APPOINTMENT,
        owner_id=appointment.id,
        attachment_id=attachment_id,
        tenant_id=current_user.tenant_id,
        caller_id=current_user.id,
    )


# ── task ─────────────────────────────────────────────────────────────────


def _task_patient_id(task: Task) -> UUID:
    if task.patient_id is None:
        raise OwnerHasNoPatientError()
    return task.patient_id


@task_collab_router.get("/tasks/{task_id}/notes", response_model=list[NoteRead])
async def list_task_notes(
    task: TaskAccessDep,
    service: NoteServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> list[NoteRead]:
    return await service.list_for_owner(
        tenant_id=current_user.tenant_id, owner_type=OwnerType.TASK, owner_id=task.id
    )


@task_collab_router.post(
    "/tasks/{task_id}/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED
)
async def add_task_note(
    task: TaskAccessDep,
    payload: NoteCreate,
    service: NoteServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> NoteRead:
    return await service.add(
        owner_type=OwnerType.TASK,
        owner_id=task.id,
        patient_id=_task_patient_id(task),
        author=current_user,
        body=payload.body,
    )


@task_collab_router.get("/tasks/{task_id}/attachments", response_model=list[AttachmentRead])
async def list_task_attachments(
    task: TaskAccessDep,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> list[AttachmentRead]:
    return await service.list_for_owner(
        tenant_id=current_user.tenant_id, owner_type=OwnerType.TASK, owner_id=task.id
    )


@task_collab_router.post(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_attachment(
    task: TaskAccessDep,
    payload: AttachmentCreate,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> AttachmentUploadResponse:
    return await service.create(
        owner_type=OwnerType.TASK,
        owner_id=task.id,
        patient_id=_task_patient_id(task),
        uploader=current_user,
        filename=payload.filename,
        content_type=payload.content_type,
        size=payload.size,
    )


@task_collab_router.get(
    "/tasks/{task_id}/attachments/{attachment_id}/url", response_model=AttachmentDownload
)
async def task_attachment_url(
    task: TaskAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> AttachmentDownload:
    return await service.download_url(
        owner_type=OwnerType.TASK,
        owner_id=task.id,
        attachment_id=attachment_id,
        tenant_id=current_user.tenant_id,
    )


@task_collab_router.delete(
    "/tasks/{task_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_task_attachment(
    task: TaskAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> None:
    await service.delete(
        owner_type=OwnerType.TASK,
        owner_id=task.id,
        attachment_id=attachment_id,
        tenant_id=current_user.tenant_id,
        caller_id=current_user.id,
    )


# ── patient (GET = aggregate across owners; POST = patient-owned) ──────────


@patient_collab_router.get("/patients/{patient_id}/notes", response_model=list[NoteRead])
async def list_patient_notes(
    patient: PatientAccessDep,
    service: NoteServiceDep,
) -> list[NoteRead]:
    return await service.list_for_patient(tenant_id=patient.tenant_id, patient_id=patient.id)


@patient_collab_router.post(
    "/patients/{patient_id}/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED
)
async def add_patient_note(
    patient: PatientAccessDep,
    payload: NoteCreate,
    service: NoteServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> NoteRead:
    return await service.add(
        owner_type=OwnerType.PATIENT,
        owner_id=patient.id,
        patient_id=patient.id,
        author=current_user,
        body=payload.body,
    )


@patient_collab_router.get(
    "/patients/{patient_id}/attachments", response_model=list[AttachmentRead]
)
async def list_patient_attachments(
    patient: PatientAccessDep,
    service: AttachmentServiceDep,
) -> list[AttachmentRead]:
    return await service.list_for_patient(tenant_id=patient.tenant_id, patient_id=patient.id)


@patient_collab_router.post(
    "/patients/{patient_id}/attachments",
    response_model=AttachmentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_patient_attachment(
    patient: PatientAccessDep,
    payload: AttachmentCreate,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> AttachmentUploadResponse:
    return await service.create(
        owner_type=OwnerType.PATIENT,
        owner_id=patient.id,
        patient_id=patient.id,
        uploader=current_user,
        filename=payload.filename,
        content_type=payload.content_type,
        size=payload.size,
    )


@patient_collab_router.get(
    "/patients/{patient_id}/attachments/{attachment_id}/url", response_model=AttachmentDownload
)
async def patient_attachment_url(
    patient: PatientAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
) -> AttachmentDownload:
    return await service.download_url(
        owner_type=OwnerType.PATIENT,
        owner_id=patient.id,
        attachment_id=attachment_id,
        tenant_id=patient.tenant_id,
    )


@patient_collab_router.delete(
    "/patients/{patient_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_patient_attachment(
    patient: PatientAccessDep,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: Annotated[SessionUser, _GUARD],
) -> None:
    await service.delete(
        owner_type=OwnerType.PATIENT,
        owner_id=patient.id,
        attachment_id=attachment_id,
        tenant_id=current_user.tenant_id,
        caller_id=current_user.id,
    )
