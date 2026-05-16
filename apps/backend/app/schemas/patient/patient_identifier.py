from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.identifiers import INSZ_SYSTEM
from app.core.validators.insz import is_valid_insz


class PatientIdentifierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    system: str
    value: str
    use: str | None = None


class PatientIdentifierCreate(BaseModel):
    """Identifier payload for `POST /patients`.

    `system` is a free-text URI — we keep the column open so unknown
    namespaces (e.g. local lab numbers) pass through. The Mod-97 check
    only runs when the system is the Belgian INSZ namespace.
    """

    system: str
    value: str
    use: str | None = None

    @field_validator("value")
    @classmethod
    def _validate_insz_checksum(cls, value: str, info) -> str:  # type: ignore[no-untyped-def]
        if info.data.get("system") == INSZ_SYSTEM and not is_valid_insz(value):
            raise ValueError("invalid INSZ checksum")
        return value
