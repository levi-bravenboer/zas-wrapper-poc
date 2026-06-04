"""Permission dependencies — the request-path face of the AME.

`check_patient_permission` is consumed by `require_patient_access`
(`app/services/patient/deps.py`), the single wiring point for all
patient-scoped routes (BL-053). Behind `AUTHZ_KETO_ENABLED`:

- flag off → callers fall back to the pre-Ory SQL predicates, byte-for-byte
  the previous behaviour;
- flag on  → one Keto `check` answers care-team membership, org-tree
  reachability, and external-episode access in a single relation walk.

Admins short-circuit to allow (tenant-wide read is a role decision, not a
relation). Denials surface as `None`/`False` so callers keep the existing
404-not-403 existence-hiding contract.
"""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, Request

from app.services.access.permissions.keto_client import KetoClient, user_subject

PatientRelation = Literal["view", "view_shielded"]


def get_keto_client(request: Request) -> KetoClient:
    return request.app.state.keto_client


KetoClientDep = Annotated[KetoClient, Depends(get_keto_client)]


async def check_patient_permission(
    keto: KetoClient,
    *,
    patient_id: UUID,
    user_id: UUID,
    relation: PatientRelation = "view",
) -> bool:
    return await keto.check(
        namespace="Patient",
        object_id=str(patient_id),
        relation=relation,
        subject_id=user_subject(user_id),
    )
