# Atomic batch reparent + reorder for the organisations tree.
#
# Service-layer cycle detection (BFS on the *proposed* parent map) is
# authoritative — the DB only enforces single-row self-loops via
# `ck_organisations_parent_not_self`. Validates tenant scope per move,
# locks the rows being mutated with `SELECT ... FOR UPDATE` so concurrent
# tree edits serialise, applies all changes inside one transaction, and
# returns the refreshed tenant tree (same shape as `GET /organisations`).

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.organisation import Organisation
from app.schemas.auth.auth import SessionUser
from app.schemas.organisation.tree import OrganisationTreeMove
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
    OrganisationTreeCycleError,
)

# Defensive cap on the cycle-detection walk length. Real org trees are
# shallow (<= 10); this guards against pathological inputs and matches the
# repository's `_MAX_TREE_DEPTH`.
_MAX_TREE_DEPTH = 64


class OrganisationTreeService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def apply_tree_moves(
        self, actor: SessionUser, moves: list[OrganisationTreeMove]
    ) -> list[Organisation]:
        tenant_id = actor.tenant_id

        move_by_id: dict[UUID, OrganisationTreeMove] = {m.id: m for m in moves}
        if len(move_by_id) != len(moves):
            # Duplicate ids would let one move clobber another silently.
            raise OrganisationTreeCycleError(
                message="Duplicate organisation id in moves.",
            )

        # Lock the rows being mutated. Concurrent editors hitting overlapping
        # ids serialise here instead of racing the cycle check.
        locked = (
            (
                await self._session.execute(
                    select(Organisation)
                    .where(
                        Organisation.id.in_(move_by_id.keys()),
                        Organisation.deleted_at.is_(None),
                    )
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        locked_by_id = {o.id: o for o in locked}

        for move_id in move_by_id:
            org = locked_by_id.get(move_id)
            if org is None or org.tenant_id != tenant_id:
                raise OrganisationNotFoundError()

        # Validate proposed parents — same tenant, exist, not soft-deleted.
        parent_ids = {
            m.parent_organisation_id
            for m in moves
            if m.parent_organisation_id is not None and m.parent_organisation_id not in move_by_id
        }
        if parent_ids:
            parents = (
                (
                    await self._session.execute(
                        select(Organisation).where(
                            Organisation.id.in_(parent_ids),
                            Organisation.deleted_at.is_(None),
                        )
                    )
                )
                .scalars()
                .all()
            )
            parents_by_id = {p.id: p for p in parents}
            for pid in parent_ids:
                parent = parents_by_id.get(pid)
                if parent is None:
                    raise OrganisationNotFoundError()
                if parent.tenant_id != tenant_id:
                    raise CrossTenantOrganisationError()

        # Build the *proposed* parent map for cycle detection: start from
        # the current tenant edges, then overlay the move edges. A move
        # whose new parent points at another moved id is the easy way to
        # introduce an indirect cycle and is what BFS catches.
        all_rows = (
            await self._session.execute(
                select(Organisation.id, Organisation.parent_organisation_id).where(
                    Organisation.tenant_id == tenant_id,
                    Organisation.deleted_at.is_(None),
                )
            )
        ).all()
        proposed_parent: dict[UUID, UUID | None] = {
            row.id: row.parent_organisation_id for row in all_rows
        }
        for m in moves:
            proposed_parent[m.id] = m.parent_organisation_id

        for moved_id in move_by_id:
            seen: set[UUID] = set()
            current: UUID | None = proposed_parent.get(moved_id)
            depth = 0
            while current is not None:
                if current == moved_id or current in seen:
                    raise OrganisationTreeCycleError()
                seen.add(current)
                depth += 1
                if depth > _MAX_TREE_DEPTH:
                    raise OrganisationTreeCycleError()
                current = proposed_parent.get(current)

        # All validation passed — apply mutations. `updated_by` /
        # `updated_at` get stamped by the audit hook on flush.
        for move in moves:
            org = locked_by_id[move.id]
            org.parent_organisation_id = move.parent_organisation_id
            org.sort_index = move.sort_index
        await self._session.flush()

        refreshed = (
            (
                await self._session.execute(
                    select(Organisation)
                    .where(
                        Organisation.tenant_id == tenant_id,
                        Organisation.deleted_at.is_(None),
                    )
                    .order_by(
                        Organisation.parent_organisation_id.asc().nulls_first(),
                        Organisation.sort_index.asc(),
                        Organisation.name.asc(),
                    )
                )
            )
            .scalars()
            .all()
        )
        return list(refreshed)
