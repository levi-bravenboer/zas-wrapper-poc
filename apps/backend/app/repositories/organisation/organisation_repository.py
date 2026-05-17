from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, literal, select

from app.db.models.organisation import Organisation
from app.db.models.patient.patient import Patient
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.repositories.base import BaseRepository

# Defensive cap on recursive-CTE depth. PoC has 3 levels; real hospital
# trees rarely exceed ~10. The cap is a safety net against a malformed
# multi-hop parent cycle (`A → B → C → A`) spinning the CTE until the
# worker OOMs. The DB-level CHECK constraint (`ck_organisations_parent_not_self`)
# blocks single-row self-loops only; multi-row cycles require either this
# cap or an application-level acyclicity guard (queued for the future
# `POST /organisations` change). Bump if real data ever justifies it.
_MAX_TREE_DEPTH = 32


class OrganisationRepository(BaseRepository[Organisation]):
    """Repository for the org-tree. All recursive walks are tenant-bounded
    on the recursive arm so that a stray cross-tenant `parent_organisation_id`
    (mis-stamped row, service-layer bypass) cannot leak rows from a sibling
    tenant into the result set. The walk terminates naturally at
    `_MAX_TREE_DEPTH` even if a cycle slips past the application guards.
    """

    model = Organisation

    async def get_by_id(self, organisation_id: UUID) -> Organisation | None:
        result = await self._session.execute(
            select(Organisation).where(
                Organisation.id == organisation_id,
                Organisation.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_in_tenant(self, tenant_id: UUID) -> list[Organisation]:
        result = await self._session.execute(
            select(Organisation).where(
                Organisation.tenant_id == tenant_id,
                Organisation.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def get_root_ancestor(self, organisation_id: UUID) -> Organisation | None:
        """Walk `parent_organisation_id` upward and return the root row in a
        single roundtrip.

        Returns `None` when the input id is missing, soft-deleted, or its
        chain hits a soft-deleted ancestor (the walk excludes such rows so
        the root is unreachable — callers treat `None` as "no resolvable
        root", same semantics as a missing org). The recursive arm filters
        on `tenant_id` equality with the anchor to keep the walk inside one
        tenant even if a row is mis-stamped.
        """

        anchor = (
            select(
                Organisation.id,
                Organisation.parent_organisation_id,
                Organisation.tenant_id,
                literal(0).label("depth"),
            )
            .where(
                Organisation.id == organisation_id,
                Organisation.deleted_at.is_(None),
            )
            .cte("org_ancestors", recursive=True)
        )
        parent = Organisation.__table__.alias("parent")
        ancestors = anchor.union_all(
            select(
                parent.c.id,
                parent.c.parent_organisation_id,
                parent.c.tenant_id,
                (anchor.c.depth + 1).label("depth"),
            ).where(
                parent.c.id == anchor.c.parent_organisation_id,
                parent.c.tenant_id == anchor.c.tenant_id,
                parent.c.deleted_at.is_(None),
                anchor.c.depth < _MAX_TREE_DEPTH,
            )
        )
        stmt = (
            select(Organisation)
            .join(ancestors, ancestors.c.id == Organisation.id)
            .where(
                ancestors.c.parent_organisation_id.is_(None),
                Organisation.deleted_at.is_(None),
            )
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def update(self, organisation: Organisation) -> Organisation:
        await self._session.flush()
        return organisation

    async def count_child_organisations(self, organisation_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(Organisation)
            .where(
                Organisation.parent_organisation_id == organisation_id,
                Organisation.deleted_at.is_(None),
            )
        )
        return int(result.scalar_one())

    async def count_patients_with_primary(self, organisation_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(Patient)
            .where(
                Patient.primary_organisation_id == organisation_id,
                Patient.deleted_at.is_(None),
            )
        )
        return int(result.scalar_one())

    async def count_open_practitioner_roles(self, organisation_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(PractitionerRole)
            .where(
                PractitionerRole.organisation_id == organisation_id,
                PractitionerRole.deleted_at.is_(None),
                PractitionerRole.period_end.is_(None),
            )
        )
        return int(result.scalar_one())

    async def get_descendant_ids(self, organisation_id: UUID) -> list[UUID]:
        """Walk `parent_organisation_id` downward and return the input id
        plus every transitive descendant id, tenant-bounded and depth-capped.

        Soft-deleted rows are excluded — a soft-deleted intermediate node
        truncates the subtree, callers see the surviving prefix only. Order
        is unspecified; callers needing tree shape should re-fetch the
        rows and rebuild the parent map client-side.
        """

        anchor = (
            select(
                Organisation.id,
                Organisation.tenant_id,
                literal(0).label("depth"),
            )
            .where(
                Organisation.id == organisation_id,
                Organisation.deleted_at.is_(None),
            )
            .cte("org_descendants", recursive=True)
        )
        child = Organisation.__table__.alias("child")
        descendants = anchor.union_all(
            select(
                child.c.id,
                child.c.tenant_id,
                (anchor.c.depth + 1).label("depth"),
            ).where(
                child.c.parent_organisation_id == anchor.c.id,
                child.c.tenant_id == anchor.c.tenant_id,
                child.c.deleted_at.is_(None),
                anchor.c.depth < _MAX_TREE_DEPTH,
            )
        )
        result = await self._session.execute(select(descendants.c.id))
        return list(result.scalars().all())
