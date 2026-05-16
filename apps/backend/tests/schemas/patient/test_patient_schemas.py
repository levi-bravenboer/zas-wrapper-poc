from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.enums.patient import Gender
from app.core.identifiers import INSZ_SYSTEM
from app.schemas.patient import (
    PatientCreate,
    PatientIdentifierCreate,
    PatientUpdate,
)


def _build_valid_insz() -> str:
    serial = "850101001"
    check = 97 - (int(serial) % 97)
    return serial + f"{check:02d}"


VALID_INSZ = _build_valid_insz()


class TestPatientIdentifierCreate:
    def test_valid_insz_passes(self) -> None:
        ident = PatientIdentifierCreate(system=INSZ_SYSTEM, value=VALID_INSZ)
        assert ident.value == VALID_INSZ

    def test_invalid_insz_rejected(self) -> None:
        with pytest.raises(ValidationError):
            PatientIdentifierCreate(system=INSZ_SYSTEM, value="00000000000")

    def test_non_insz_system_skips_checksum(self) -> None:
        # Any value passes when the system isn't the INSZ namespace.
        ident = PatientIdentifierCreate(system="urn:zas:hix:mrn", value="ANY")
        assert ident.value == "ANY"


class TestPatientUpdate:
    def test_demographics_only(self) -> None:
        payload = PatientUpdate(given_name="Jan", family_name="Janssens")
        assert payload.given_name == "Jan"

    def test_identifiers_field_rejected(self) -> None:
        # PATCH must NEVER accept identifier edits — extra="forbid" makes
        # Pydantic emit `extra_forbidden`, which FastAPI surfaces as 422.
        with pytest.raises(ValidationError):
            PatientUpdate.model_validate(
                {"given_name": "Jan", "identifiers": [{"system": "x", "value": "y"}]}
            )


class TestPatientCreate:
    def test_gender_enum_round_trip(self) -> None:
        payload = PatientCreate(
            primary_organisation_id=uuid4(),
            given_name="Jan",
            family_name="Janssens",
            gender=Gender.MALE,
        )
        assert payload.gender == Gender.MALE
        dumped = payload.model_dump(mode="json")
        assert dumped["gender"] == "male"

    def test_inline_identifiers_validated(self) -> None:
        with pytest.raises(ValidationError):
            PatientCreate(
                primary_organisation_id=uuid4(),
                given_name="Jan",
                family_name="Janssens",
                gender=Gender.MALE,
                identifiers=[PatientIdentifierCreate(system=INSZ_SYSTEM, value="bad")],
            )
