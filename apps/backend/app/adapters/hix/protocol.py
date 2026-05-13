"""HiX adapter Protocol.

This is the FHIR-facing seam: HiX speaks SMART-on-FHIR R4 in production, so the
Protocol mirrors that vocabulary (read / search / create) even while the PoC
serves stub fixtures. Section 12 of `backend-setup` swaps the placeholder
`Patient` model below for `fhir.resources` types and adds search/create.
"""

from __future__ import annotations

from typing import Protocol

from app.schemas.fhir import Patient


class HixClient(Protocol):
    async def ping(self) -> None:
        """Cheap reachability probe. Raises on failure; caught by readiness registry."""
        ...

    async def get_patient(self, reference: str) -> Patient:
        """Placeholder until §12 introduces `read(resource_type, resource_id)`."""
        ...
