from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.collaboration import OwnerType
from app.db.models.collaboration import Attachment
from app.db.models.user import User


class AttachmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_owner(
        self, *, tenant_id: UUID, owner_type: OwnerType, owner_id: UUID
    ) -> Sequence[tuple[Attachment, str]]:
        return await self._list(
            Attachment.owner_type == owner_type,
            Attachment.owner_id == owner_id,
            tenant_id=tenant_id,
        )

    async def list_for_patient(
        self, *, tenant_id: UUID, patient_id: UUID
    ) -> Sequence[tuple[Attachment, str]]:
        return await self._list(Attachment.patient_id == patient_id, tenant_id=tenant_id)

    async def _list(self, *predicates, tenant_id: UUID) -> Sequence[tuple[Attachment, str]]:
        result = await self._session.execute(
            select(Attachment, User.display_name)
            .join(User, User.id == Attachment.uploaded_by)
            .where(Attachment.tenant_id == tenant_id, Attachment.deleted_at.is_(None), *predicates)
            .order_by(Attachment.created_at.desc(), Attachment.id.desc())
        )
        return result.tuples().all()

    async def add(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        patient_id: UUID,
        uploaded_by: UUID,
        filename: str,
        content_type: str,
        size: int,
        storage_key: str,
    ) -> Attachment:
        attachment = Attachment(
            owner_type=owner_type,
            owner_id=owner_id,
            patient_id=patient_id,
            uploaded_by=uploaded_by,
            filename=filename,
            content_type=content_type,
            size=size,
            storage_key=storage_key,
        )
        self._session.add(attachment)
        await self._session.flush()
        return attachment

    async def get(self, *, attachment_id: UUID, tenant_id: UUID) -> Attachment | None:
        result = await self._session.execute(
            select(Attachment).where(
                Attachment.id == attachment_id,
                Attachment.tenant_id == tenant_id,
                Attachment.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, attachment: Attachment) -> None:
        attachment.deleted_at = func.now()
        await self._session.flush()
