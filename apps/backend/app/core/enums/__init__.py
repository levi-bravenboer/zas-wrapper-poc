"""Cross-domain enum types. Kept under `app.core` so they are importable from
both `app.db.models.*` and `app.api.*` without circular-import risk.
"""

from app.core.enums.user import Role

__all__ = ["Role"]
