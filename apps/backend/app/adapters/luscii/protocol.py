"""Luscii adapter Protocol.

Luscii's API is vendor-shaped, not FHIR. The Protocol therefore mirrors
Luscii's own primitives; FHIR mapping happens in `app.adapters.luscii.mappers`
(introduced in §12).
"""

from __future__ import annotations

from typing import Protocol


class LusciiClient(Protocol):
    async def ping(self) -> None:
        """Cheap reachability probe. Raises on failure; caught by readiness registry."""
        ...
