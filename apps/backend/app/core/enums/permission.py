"""RBAC permission catalog (`dynamic-rbac-roles-permissions`).

Each member is a `resource.action` slug (standard RBAC shape) backed by a real
route/action guard. Roles are assigned a subset of these; `require_permission`
checks them. The catalog is code-defined on purpose — admins assign existing
slugs to roles, they cannot invent permissions no guard enforces.

Scope: RBAC gates app FUNCTIONS (config/admin resources + app actions).
Patient *data* access stays Keto's job — `PATIENT_ACCESS_ALL` is the single
seam (the Keto bypass the former `Role.ADMIN` short-circuit provided).

Verb vocabulary is canonical: CRUD = create/read/update/delete (no synonyms);
domain verbs only where a real action exists. No wildcard / manage-all alias.
"""

from __future__ import annotations

from enum import StrEnum


class Permission(StrEnum):
    ORGANISATION_CREATE = "organisation.create"
    ORGANISATION_READ = "organisation.read"
    ORGANISATION_UPDATE = "organisation.update"
    ORGANISATION_DELETE = "organisation.delete"

    USER_CREATE = "user.create"
    USER_READ = "user.read"
    USER_UPDATE = "user.update"
    USER_DELETE = "user.delete"

    ROLE_CREATE = "role.create"
    ROLE_READ = "role.read"
    ROLE_UPDATE = "role.update"
    ROLE_DELETE = "role.delete"

    PRACTITIONER_ROLE_CREATE = "practitionerRole.create"
    PRACTITIONER_ROLE_READ = "practitionerRole.read"
    PRACTITIONER_ROLE_UPDATE = "practitionerRole.update"
    PRACTITIONER_ROLE_DELETE = "practitionerRole.delete"

    SHIELDING_RULE_READ = "shieldingRule.read"
    SHIELDING_RULE_UPDATE = "shieldingRule.update"

    # Specialism master data + carepath/role specialism scoping (scoping_router).
    SPECIALISM_READ = "specialism.read"
    SPECIALISM_CREATE = "specialism.create"
    SPECIALISM_UPDATE = "specialism.update"
    SPECIALISM_DELETE = "specialism.delete"

    # External-collaboration config: access profiles, consents, external grants
    # (external_router). The patient-scoped data the grant unlocks stays Keto.
    EXTERNAL_COLLABORATION_READ = "externalCollaboration.read"
    EXTERNAL_COLLABORATION_CREATE = "externalCollaboration.create"
    EXTERNAL_COLLABORATION_UPDATE = "externalCollaboration.update"
    EXTERNAL_COLLABORATION_DELETE = "externalCollaboration.delete"

    BREAK_GLASS_REQUEST = "breakGlass.request"
    BREAK_GLASS_OVERSEE = "breakGlass.oversee"

    PATHWAY_READ = "pathway.read"
    PATHWAY_MANAGE_RUNTIME = "pathway.manageRuntime"

    AUDIT_READ = "audit.read"

    # The single RBAC↔Keto seam: reproduces the old Role.ADMIN patient-data
    # bypass. Crown permission — admin-role-only to grant/assign (escalation
    # guard, see app/services/access/rbac).
    PATIENT_ACCESS_ALL = "patient.accessAll"

    # Patient onboarding (app function, not data access). `patient.create`
    # guards POST /patients; `patient.createCrossOrg` lets a caller target an
    # organisation other than their own affiliated org(s). Neither is crown nor
    # grants patient-data visibility — the create flow adds the creator to the
    # new patient's care team for that one patient.
    PATIENT_CREATE = "patient.create"
    PATIENT_CREATE_CROSS_ORG = "patient.createCrossOrg"


# Crown permissions: only an admin-role holder may grant these to a role or
# assign a role holding them (privilege-escalation guard D7/D7a). `role.*`
# writes are crown because granting them would let a role edit roles.
CROWN_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.PATIENT_ACCESS_ALL,
        Permission.ROLE_CREATE,
        Permission.ROLE_UPDATE,
        Permission.ROLE_DELETE,
    }
)
