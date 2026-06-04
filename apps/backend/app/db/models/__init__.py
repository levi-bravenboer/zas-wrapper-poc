"""ORM model registry. Importing this module registers every model on
`Base.metadata`. Alembic's `env.py` imports this package for autogenerate.
"""

from app.db.models.authz import AuthzOutbox
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient, PatientIdentifier
from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayBlockBranch,
    PathwayBlockDeferredField,
    PathwayEdge,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
    PathwayVersion,
)
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.tenant import Tenant
from app.db.models.user import User

__all__ = [
    "AuthzOutbox",
    "CareTeam",
    "CareTeamParticipant",
    "Organisation",
    "Pathway",
    "PathwayBlock",
    "PathwayBlockBranch",
    "PathwayBlockDeferredField",
    "PathwayEdge",
    "PathwayLane",
    "PathwayLaneKind",
    "PathwayPhase",
    "PathwayTimeMarker",
    "PathwayTimingValue",
    "PathwayVersion",
    "Patient",
    "PatientIdentifier",
    "Practitioner",
    "PractitionerRole",
    "Tenant",
    "User",
]
