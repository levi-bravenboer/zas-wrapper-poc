# HiX patient adapter seam. MVP wiring point — body lands when SMART-on-FHIR
# launch + HiX endpoints are available. Importing the class now reserves the
# module path and gives type-checkers/IDE auto-complete something to bind to,
# so the day we replace the body we do not also have to refactor every call
# site. See openspec/changes/patients-base/design.md D5.

from __future__ import annotations

from typing import Any

_MVP_SCOPE_MESSAGE = "HiX patient adapter is MVP scope"


class HixPatientAdapter:
    """Reserved import path for the HiX `Patient` projection."""

    async def fetch(self, external_ref: str) -> Any:
        raise NotImplementedError(_MVP_SCOPE_MESSAGE)

    async def upsert_from_hix(self, payload: Any) -> Any:
        raise NotImplementedError(_MVP_SCOPE_MESSAGE)
