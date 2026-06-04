"""Session → active-role binding (REQ-NON-3, REQ-FUN-4).

One Kratos identity may map to several role-scoped `users` rows; the
binding records which row a concrete Kratos session acts as. Single-row
rosters never write a binding (resolution short-circuits); multi-row
rosters require one before protected routes answer. Role switch rewrites
the same row (audited by the caller).

Bindings keyed by revoked sessions are dead weight: whoami fails before
the binding is ever consulted. They are deleted opportunistically when a
new binding for the same user logs in (cheap heuristic, not a guarantee).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.access.session_role_binding import SessionRoleBinding


async def get_bound_user_id(session: AsyncSession, kratos_session_id: str) -> UUID | None:
    return await session.scalar(
        select(SessionRoleBinding.user_id).where(
            SessionRoleBinding.kratos_session_id == kratos_session_id
        )
    )


async def bind_session_role(
    session: AsyncSession, *, kratos_session_id: str, user_id: UUID
) -> None:
    binding = await session.get(SessionRoleBinding, kratos_session_id)
    if binding is None:
        session.add(SessionRoleBinding(kratos_session_id=kratos_session_id, user_id=user_id))
    else:
        binding.user_id = user_id
    await session.flush()
