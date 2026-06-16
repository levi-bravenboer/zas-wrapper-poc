from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment.appointment_attachment import AppointmentAttachment
from app.db.models.user import User


class AppointmentAttachmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_appointment(
        self, appointment_id: UUID
    ) -> Sequence[tuple[AppointmentAttachment, str]]:
        result = await self._session.execute(
            select(AppointmentAttachment, User.display_name)
            .join(User, User.id == AppointmentAttachment.uploaded_by)
            .where(
                AppointmentAttachment.appointment_id == appointment_id,
                AppointmentAttachment.deleted_at.is_(None),
            )
            .order_by(
                AppointmentAttachment.created_at.desc(), AppointmentAttachment.id.desc()
            )
        )
        return result.tuples().all()

    async def add(
        self,
        *,
        appointment_id: UUID,
        uploaded_by: UUID,
        filename: str,
        content_type: str,
        size: int,
        storage_key: str,
    ) -> AppointmentAttachment:
        attachment = AppointmentAttachment(
            appointment_id=appointment_id,
            uploaded_by=uploaded_by,
            filename=filename,
            content_type=content_type,
            size=size,
            storage_key=storage_key,
        )
        self._session.add(attachment)
        await self._session.flush()
        return attachment

    async def get(
        self, *, attachment_id: UUID, tenant_id: UUID
    ) -> AppointmentAttachment | None:
        result = await self._session.execute(
            select(AppointmentAttachment).where(
                AppointmentAttachment.id == attachment_id,
                AppointmentAttachment.tenant_id == tenant_id,
                AppointmentAttachment.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, attachment: AppointmentAttachment) -> None:
        attachment.deleted_at = func.now()
        await self._session.flush()
