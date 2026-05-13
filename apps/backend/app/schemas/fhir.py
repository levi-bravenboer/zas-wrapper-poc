"""Placeholder FHIR-shaped Pydantic models.

These are temporary stand-ins so adapter Protocols can compile before the
`fhir.resources` dependency lands in section 12. Once the FHIR-ready domain
layer is in place, importers should switch to `fhir.resources` types directly.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Gender = Literal["male", "female", "other", "unknown"]


class Patient(BaseModel):
    """Placeholder Patient resource. Replaced by `fhir.resources.patient.Patient` in §12."""

    id: str
    name: str
    birthdate: date | None = None
    gender: Gender | None = None
    resource_type: Literal["Patient"] = Field(default="Patient", alias="resourceType")

    model_config = {"populate_by_name": True}
