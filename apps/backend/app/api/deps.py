"""Cross-cutting dependency aliases for routers.

Per-domain `Annotated[..., Depends(...)]` factories live alongside the
service they wire (e.g. `app/services/<domain>/deps.py`). This module
only re-exports aliases that have no domain (settings, db session).
"""

from __future__ import annotations

from app.core.settings import SettingsDep
from app.db.engine import SessionDep

__all__ = ["SessionDep", "SettingsDep"]
