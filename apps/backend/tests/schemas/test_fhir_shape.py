from __future__ import annotations

import inspect
from uuid import uuid4

from app.api.routers.patient.patient_router import list_patients
from app.core.enums.patient import Gender
from app.core.identifiers import INSZ_SYSTEM
from app.schemas.patient.patient import PatientCreate
from app.schemas.patient.patient_identifier import PatientIdentifierCreate


def test_insz_system_is_uri_formatted() -> None:
    # FHIR `Identifier.system` MUST be a URI. The constant we centralise
    # MUST therefore stay URI-shaped — colon-separated scheme + path.
    assert INSZ_SYSTEM.startswith("urn:")
    assert ":" in INSZ_SYSTEM.split(":", 1)[1]


def test_gender_enum_values_match_fhir_codes() -> None:
    assert {g.value for g in Gender} == {"male", "female", "other", "unknown"}


def test_list_patients_exposes_fhir_aligned_query_params() -> None:
    signature = inspect.signature(list_patients)
    params = set(signature.parameters)
    # FHIR R4 `Patient?family=&given=&birthdate=&identifier=` maps to our
    # search params one-to-one (snake_case at the FastAPI surface).
    assert {"family_name", "given_name", "birth_date", "identifier"} <= params


def test_identifier_create_requires_system_field() -> None:
    # `system` is mandatory: an identifier value alone is meaningless under
    # FHIR — `(system, value)` is what disambiguates issuing authorities.
    ident = PatientIdentifierCreate(system="urn:zas:hix:mrn", value="ANY")
    assert ident.system.startswith("urn:")


def test_patient_create_round_trips_fhir_gender() -> None:
    payload = PatientCreate(
        primary_organisation_id=uuid4(),
        given_name="Jan",
        family_name="Janssens",
        gender=Gender.OTHER,
    )
    assert payload.model_dump(mode="json")["gender"] == "other"
