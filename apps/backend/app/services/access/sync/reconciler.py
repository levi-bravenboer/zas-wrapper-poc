"""Converge Keto toward the tuple set derived from Postgres.

`reconcile_object` is the unit of work the relay applies per outbox row;
`reconcile_all` is the same operation over every namespace — used for
initial population (the cutover migration), demo seeding, on-demand runs
(`python -m scripts.reconcile_authz_tuples`), and drift detection.

Relations listed in `derive.EXTERNAL_RELATIONS` (no domain source yet,
e.g. demo-seeded `external_carer` episodes) are never treated as orphans.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.access.permissions.keto_client import (
    KetoClient,
    KetoNamespace,
    RelationTuple,
)
from app.services.access.sync.derive import (
    EXTERNAL_RELATIONS,
    derive_all_tuples,
    derive_care_team_tuples,
    derive_organisation_tuples,
    derive_patient_tuples,
)

logger = logging.getLogger(__name__)

NAMESPACES: tuple[KetoNamespace, ...] = ("Organisation", "CareTeam", "Patient")


@dataclass(frozen=True)
class ReconcileStats:
    inserted: int
    deleted: int

    @property
    def drifted(self) -> bool:
        return bool(self.inserted or self.deleted)


def _managed(tuples: list[RelationTuple]) -> set[RelationTuple]:
    return {t for t in tuples if (t.namespace, t.relation) not in EXTERNAL_RELATIONS}


async def _converge(
    keto: KetoClient,
    expected: set[RelationTuple],
    actual: set[RelationTuple],
) -> ReconcileStats:
    missing = expected - actual
    orphaned = actual - expected
    for relation_tuple in missing:
        await keto.insert_tuple(relation_tuple)
    for relation_tuple in orphaned:
        await keto.delete_tuple(relation_tuple)
    return ReconcileStats(inserted=len(missing), deleted=len(orphaned))


async def reconcile_object(
    session: AsyncSession,
    keto: KetoClient,
    *,
    namespace: KetoNamespace,
    object_id: UUID,
) -> ReconcileStats:
    if namespace == "Organisation":
        expected = await derive_organisation_tuples(session, organisation_id=object_id)
    elif namespace == "CareTeam":
        expected = await derive_care_team_tuples(session, care_team_id=object_id)
    else:
        expected = await derive_patient_tuples(session, patient_id=object_id)
    actual = _managed(await keto.query_tuples(namespace=namespace, object_id=str(object_id)))
    return await _converge(keto, expected, actual)


async def reconcile_all(
    session: AsyncSession, keto: KetoClient, *, log_drift: bool = True
) -> ReconcileStats:
    expected = await derive_all_tuples(session)
    actual: set[RelationTuple] = set()
    for namespace in NAMESPACES:
        actual |= _managed(await keto.query_tuples(namespace=namespace))
    stats = await _converge(keto, expected, actual)
    if log_drift and stats.drifted:
        logger.warning(
            "authz tuple drift converged: %d inserted, %d orphaned deleted",
            stats.inserted,
            stats.deleted,
        )
    return stats
