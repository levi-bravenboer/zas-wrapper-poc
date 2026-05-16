"""Cross-domain enum types. Kept under `app.core` so they are importable from
both `app.db.models.*` and `app.api.*` without circular-import risk.
"""

from app.core.enums.care_team import CareTeamStatus, RoleInCare
from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM, OrganisationTypeCode
from app.core.enums.patient import Gender, PatientSource
from app.core.enums.practitioner_role import PractitionerRoleCode
from app.core.enums.user import Role

__all__ = [
    "ORGANISATION_TYPE_SYSTEM",
    "CareTeamStatus",
    "Gender",
    "OrganisationTypeCode",
    "PatientSource",
    "PractitionerRoleCode",
    "Role",
    "RoleInCare",
]
