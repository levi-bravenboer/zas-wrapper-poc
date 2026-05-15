"""Pure predicates for organisation-tree externality.

The "external" concept in the domain has shifted from a `Role.EXTERNAL` flag
on the user to a derived relation between two organisation roots. A user is
"external" *relative to a patient* when their organisation tree does not
share a root with the patient's organisation tree.

Keeping this as a pure function keyed on already-resolved root-ancestor IDs
lets callers (services in downstream features like `patients-base`,
`care-teams-base`) resolve roots via `OrganisationRepository.get_root_ancestor`
once and then compose predicates without re-walking the tree.
"""

from __future__ import annotations

from uuid import UUID


def is_external_for_root(
    user_root_org_id: UUID | None,
    patient_root_org_id: UUID | None,
) -> bool:
    """Return True iff the user's org-tree root differs from the patient's.

    `None` on either side means the root could not be resolved (missing or
    soft-deleted org) — treat as external (most-restrictive default).
    """
    if user_root_org_id is None or patient_root_org_id is None:
        return True
    return user_root_org_id != patient_root_org_id
