from app.repositories.practitioner_role.deps import (
    PractitionerRoleRepoDep,
    get_practitioner_role_repository,
)
from app.repositories.practitioner_role.practitioner_role_repository import (
    PractitionerRoleRepository,
)

__all__ = [
    "PractitionerRoleRepoDep",
    "PractitionerRoleRepository",
    "get_practitioner_role_repository",
]
