"""External adapter package.

Exposes per-vendor sub-packages and boot-time helpers used by `create_app()`
to wire readiness pings. FastAPI route handlers should depend on the
factories in `app.adapters.deps` rather than reaching in here directly.
"""

from __future__ import annotations

from app.adapters.deps import (
    HixClientDep,
    LusciiClientDep,
    build_hix_client,
    build_luscii_client,
    get_hix_client,
    get_luscii_client,
)

__all__ = [
    "HixClientDep",
    "LusciiClientDep",
    "build_hix_client",
    "build_luscii_client",
    "get_hix_client",
    "get_luscii_client",
]
