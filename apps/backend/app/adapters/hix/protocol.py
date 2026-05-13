"""HiX adapter Protocol.

PoC scope (`openspec/scope.md`) excludes live HiX and any FHIR-shaped surface;
the Protocol is narrowed to a reachability probe. FHIR verbs return at `[mvp]`
via the future `hix-fhir-proxy` change.
"""

from __future__ import annotations

from typing import Protocol


class HixClient(Protocol):
    async def ping(self) -> None:
        """Cheap reachability probe. Raises on failure; caught by readiness registry."""
        ...
