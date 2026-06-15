"""ORM model registry. Importing this module registers every model on
`Base.metadata`. Alembic's `env.py` imports this package for autogenerate.
"""

from app.db.models.access import (
    AccessGrant,
    Consent,
    ExternalAccessProfile,
    ExternalGrant,
    SessionRoleBinding,
    ShieldedItem,
    ShieldingRule,
)
from app.db.models.appointment import Appointment, AppointmentParticipant
from app.db.models.authz import AuthzOutbox
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient, PatientIdentifier
from app.db.models.pathway import (
    Pathway,
    PathwayPractitioner,
    PathwaySpecialism,
    PathwayBlock,
    PathwayBlockBranch,
    PathwayBlockDeferredField,
    PathwayBlockExecution,
    PathwayDeferredFieldValue,
    PathwayEnrollment,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
    PathwayVersion,
)
from app.db.models.practitioner import (
    Practitioner,
    PractitionerRole,
    PractitionerRoleSpecialism,
    Specialism,
)
from app.db.models.tenant import Tenant
from app.db.models.user import User

__all__ = [
    "AccessGrant",
    "Appointment",
    "AppointmentParticipant",
    "AuthzOutbox",
    "CareTeam",
    "CareTeamParticipant",
    "LusciiInstrumentItemLocalisationRow",
    "LusciiInstrumentLocalisationRow",
    "LusciiItemResponseLocalisationRow",
    "Organisation",
    "Pathway",
    "PathwayBlock",
    "PathwayBlockBranch",
    "PathwayBlockDeferredField",
    "PathwayBlockExecution",
    "PathwayDeferredFieldValue",
    "PathwayEnrollment",
    "PathwayLane",
    "PathwayLaneKind",
    "PathwayPhase",
    "PathwayTimeMarker",
    "PathwayTimingValue",
    "PathwayVersion",
    "Consent",
    "ExternalAccessProfile",
    "ExternalGrant",
    "Patient",
    "PatientIdentifier",
    "PathwayPractitioner",
    "PathwaySpecialism",
    "Practitioner",
    "PractitionerRole",
    "PractitionerRoleSpecialism",
    "SessionRoleBinding",
    "ShieldedItem",
    "ShieldingRule",
    "Specialism",
    "Tenant",
    "User",
]
