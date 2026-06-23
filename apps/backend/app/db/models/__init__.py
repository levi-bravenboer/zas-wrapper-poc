"""ORM model registry. Importing this module registers every model on
`Base.metadata`. Alembic's `env.py` imports this package for autogenerate.
"""

from app.db.models.access import (
    AccessGrant,
    Consent,
    ExternalAccessProfile,
    ExternalGrant,
    Role,
    RolePermission,
    SessionRoleBinding,
    ShieldedItem,
    ShieldingRule,
)
from app.db.models.appointment import (
    Appointment,
    AppointmentParticipant,
    AppointmentPatientAttendee,
)
from app.db.models.audit import AuditEvent
from app.db.models.authz import AuthzOutbox
from app.db.models.collaboration import Note
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.db.models.organisation import Organisation
from app.db.models.patient import Observation, Patient, PatientIdentifier, PatientLusciiConnection
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
from app.db.models.task import Task
from app.db.models.tenant import Tenant
from app.db.models.user import User

__all__ = [
    "AccessGrant",
    "Appointment",
    "AppointmentParticipant",
    "AppointmentPatientAttendee",
    "AuditEvent",
    "AuthzOutbox",
    "CareTeam",
    "CareTeamParticipant",
    "LusciiInstrumentItemLocalisationRow",
    "LusciiInstrumentLocalisationRow",
    "LusciiItemResponseLocalisationRow",
    "Note",
    "Observation",
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
    "PatientLusciiConnection",
    "PathwayPractitioner",
    "PathwaySpecialism",
    "Practitioner",
    "PractitionerRole",
    "PractitionerRoleSpecialism",
    "Role",
    "RolePermission",
    "SessionRoleBinding",
    "ShieldedItem",
    "ShieldingRule",
    "Specialism",
    "Task",
    "Tenant",
    "User",
]
