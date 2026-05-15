"""ORM model registry. Importing this module registers every model on
`Base.metadata`. Alembic's `env.py` imports this package for autogenerate.
"""

from app.db.models.tenant import Tenant
from app.db.models.user import User

__all__ = ["Tenant", "User"]
