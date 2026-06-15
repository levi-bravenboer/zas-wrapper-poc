"""Luscii link + patient-data endpoint tests (luscii-patient-enrichment)."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.luscii import (
    LusciiMeasurement,
    LusciiPatientDetails,
    LusciiPlannedAction,
    LusciiProgramRef,
    LusciiProtocolRef,
)
from app.core.identifiers import LUSCII_PATIENT_SYSTEM
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.db.models.patient import Patient, PatientIdentifier
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_users import ADMIN_EMAIL
from tests.fakes.luscii import FakeLusciiClient


@pytest.fixture(autouse=True)
async def _clean_luscii_catalogue(db_session: AsyncSession) -> None:
    # Catalogue tables are not tenant-scoped, so `clean_tenants` never wipes
    # them — clear explicitly so natural-key inserts can't collide across tests.
    for model in (
        LusciiInstrumentLocalisationRow,
        LusciiInstrumentItemLocalisationRow,
        LusciiItemResponseLocalisationRow,
    ):
        await db_session.execute(delete(model))
    await db_session.commit()


_DEFAULT_PASSWORD = "changeme"

LUSCII_ID = "7659dfb3-c089-4d12-95b7-46ff8ce1e7dd"
OTHER_LUSCII_ID = "8a51c0aa-9f2e-4f15-8a55-1c6c4a14e7aa"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


@pytest.fixture
def luscii(app: FastAPI) -> FakeLusciiClient:
    fake = FakeLusciiClient()
    fake.patients[LUSCII_ID] = LusciiPatientDetails(
        id=LUSCII_ID,
        status="active",
        program=LusciiProgramRef(id="p-1", name="Hartfalen programma"),
        protocol=LusciiProtocolRef(id="pr-1", name="Intake protocol"),
    )
    fake.patients[OTHER_LUSCII_ID] = LusciiPatientDetails(id=OTHER_LUSCII_ID, status="active")
    app.state.luscii_client = fake
    return fake


def _link_url(patient: Patient) -> str:
    return f"/patients/{patient.id}/luscii-link"


def _data_url(patient: Patient) -> str:
    return f"/patients/{patient.id}/luscii-data"


# ---- linking ---------------------------------------------------------------


async def test_link_happy_path_persists_and_echoes_program(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
    db_session: AsyncSession,
) -> None:
    patient = seeded_zas_patients[0]
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["luscii_patient_id"] == LUSCII_ID
    assert body["program_name"] == "Hartfalen programma"
    assert body["protocol_name"] == "Intake protocol"

    rows = (
        await db_session.scalars(
            select(PatientIdentifier).where(
                PatientIdentifier.patient_id == patient.id,
                PatientIdentifier.system == LUSCII_PATIENT_SYSTEM,
                PatientIdentifier.deleted_at.is_(None),
            )
        )
    ).all()
    assert len(rows) == 1
    assert rows[0].value == LUSCII_ID
    assert rows[0].use == "secondary"


async def test_link_unknown_luscii_id_rejected_with_422(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.put(
        _link_url(seeded_zas_patients[0]),
        json={"luscii_patient_id": str(uuid.uuid4())},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid.luscii.patient_not_found"


async def test_link_upstream_down_returns_502_and_persists_nothing(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
    db_session: AsyncSession,
) -> None:
    luscii.fail = True
    patient = seeded_zas_patients[0]
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})
    assert response.status_code == 502
    assert response.json()["code"] == "unavailable.luscii.upstream"
    count = (
        await db_session.scalars(
            select(PatientIdentifier).where(PatientIdentifier.patient_id == patient.id)
        )
    ).all()
    assert all(r.system != LUSCII_PATIENT_SYSTEM for r in count)


async def test_relink_replaces_previous_link(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
    db_session: AsyncSession,
) -> None:
    patient = seeded_zas_patients[0]
    await _login(async_client, ADMIN_EMAIL)
    assert (
        await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})
    ).status_code == 200
    assert (
        await async_client.put(_link_url(patient), json={"luscii_patient_id": OTHER_LUSCII_ID})
    ).status_code == 200

    rows = (
        await db_session.scalars(
            select(PatientIdentifier).where(
                PatientIdentifier.patient_id == patient.id,
                PatientIdentifier.system == LUSCII_PATIENT_SYSTEM,
            )
        )
    ).all()
    active = [r for r in rows if r.deleted_at is None]
    assert [r.value for r in active] == [OTHER_LUSCII_ID]
    assert any(r.deleted_at is not None and r.value == LUSCII_ID for r in rows)


async def test_link_conflict_when_luscii_id_linked_to_other_patient(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    first, second = seeded_zas_patients[0], seeded_zas_patients[1]
    assert (
        await async_client.put(_link_url(first), json={"luscii_patient_id": LUSCII_ID})
    ).status_code == 200
    response = await async_client.put(_link_url(second), json={"luscii_patient_id": LUSCII_ID})
    assert response.status_code == 409
    assert response.json()["code"] == "conflict.luscii.already_linked"


async def test_unlink_is_idempotent(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    patient = seeded_zas_patients[0]
    await _login(async_client, ADMIN_EMAIL)
    assert (
        await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})
    ).status_code == 200
    assert (await async_client.delete(_link_url(patient))).status_code == 204
    # No link present: still 204.
    assert (await async_client.delete(_link_url(patient))).status_code == 204


async def test_link_requires_authentication(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    response = await async_client.put(
        _link_url(seeded_zas_patients[0]), json={"luscii_patient_id": LUSCII_ID}
    )
    assert response.status_code == 401


async def test_link_not_configured_returns_503(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    app: FastAPI,
) -> None:
    app.state.luscii_client = None
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.put(
        _link_url(seeded_zas_patients[0]), json={"luscii_patient_id": LUSCII_ID}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "unavailable.luscii.not_configured"


async def test_replaced_link_not_exposed_in_patient_read(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    patient = seeded_zas_patients[0]
    await _login(async_client, ADMIN_EMAIL)
    await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})
    await async_client.put(_link_url(patient), json={"luscii_patient_id": OTHER_LUSCII_ID})
    response = await async_client.get(f"/patients/{patient.id}")
    assert response.status_code == 200
    luscii_values = [
        i["value"] for i in response.json()["identifiers"] if i["system"] == LUSCII_PATIENT_SYSTEM
    ]
    assert luscii_values == [OTHER_LUSCII_ID]


async def test_post_patients_rejects_luscii_system_identifier(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    del seeded_zas_patients
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.post(
        "/patients",
        json={
            "primary_organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "given_name": "Nieuwe",
            "family_name": "Patient",
            "gender": "female",
            "identifiers": [{"system": LUSCII_PATIENT_SYSTEM, "value": LUSCII_ID}],
        },
    )
    assert response.status_code == 422


# ---- aggregation -------------------------------------------------------------


def _measurement(
    *,
    measurement_id: str,
    planned_action_id: str | None,
    patient_id: str = LUSCII_ID,
    details: list[dict] | None = None,
) -> LusciiMeasurement:
    return LusciiMeasurement(
        measurement_id=measurement_id,
        patient_id=patient_id,
        planned_action_id=planned_action_id,
        instrument_id="i-1",
        instrument_version="iv-1",
        created_at=datetime(2026, 6, 1, 9, 0, tzinfo=UTC),
        details=json.dumps(details or []),
    )


async def _seed_aggregation_fixtures(luscii: FakeLusciiClient, db_session: AsyncSession) -> None:
    luscii.planned_actions = [
        LusciiPlannedAction(
            id="pa-1",
            patient_id=LUSCII_ID,
            not_before=datetime(2026, 6, 1, 8, 0, tzinfo=UTC),
            completed_at=datetime(2026, 6, 1, 9, 5, tzinfo=UTC),
        ),
        LusciiPlannedAction(id="pa-2", patient_id=LUSCII_ID),
    ]
    luscii.measurements = [
        _measurement(
            measurement_id="m-1",
            planned_action_id="pa-1",
            details=[
                {
                    "item_id": "item-w",
                    "item_version": "v1",
                    "value": "82",
                    "response_ids": [],
                },
                {
                    "item_id": "item-q",
                    "item_version": "v1",
                    "value": None,
                    "response_ids": ["resp-yes"],
                },
                {
                    "item_id": "item-unknown",
                    "item_version": "v9",
                    "value": "raw-only",
                    "response_ids": [],
                },
            ],
        ),
        _measurement(measurement_id="m-2", planned_action_id=None),
        # Another Luscii patient's measurement — must be filtered out.
        _measurement(
            measurement_id="m-other",
            planned_action_id=None,
            patient_id=OTHER_LUSCII_ID,
        ),
    ]
    # Labels come from the locally synced catalogue tables (catalogue_sync).
    db_session.add_all(
        [
            LusciiInstrumentLocalisationRow(
                instrument_id="i-1", instrument_version="iv-1", locale="nl", name="Gewicht meting"
            ),
            LusciiInstrumentItemLocalisationRow(
                item_id="item-w", item_version="v1", locale="en", title="Weight", unit="kg"
            ),
            LusciiInstrumentItemLocalisationRow(
                item_id="item-w", item_version="v1", locale="nl", title="Gewicht", unit="kg"
            ),
            # item-q only has an English localisation — locale fallback case.
            LusciiInstrumentItemLocalisationRow(
                item_id="item-q", item_version="v1", locale="en", title="Feeling ok?"
            ),
            LusciiItemResponseLocalisationRow(
                item_response_id="resp-yes", locale="nl", response_text="Ja"
            ),
        ]
    )
    await db_session.commit()


async def test_luscii_data_merges_actions_and_measurements(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
    db_session: AsyncSession,
) -> None:
    patient = seeded_zas_patients[0]
    await _seed_aggregation_fixtures(luscii, db_session)
    await _login(async_client, ADMIN_EMAIL)
    await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})

    response = await async_client.get(_data_url(patient))
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["state"] == "linked"
    assert body["window_days"] == 30
    assert body["program"]["name"] == "Hartfalen programma"
    assert body["protocol"]["name"] == "Intake protocol"

    actions = {a["id"]: a for a in body["planned_actions"]}
    assert set(actions) == {"pa-1", "pa-2"}
    matched = actions["pa-1"]["measurement"]
    assert matched["measurement_id"] == "m-1"
    assert matched["instrument_name"] == "Gewicht meting"
    assert matched["instrument_id"] == "i-1"
    values = matched["values"]
    # nl localisation preferred over en; new wire fields tagged on every value.
    assert {
        "label": "Gewicht",
        "value": "82",
        "unit": "kg",
        "response_texts": [],
        "item_id": "item-w",
        "instrument_id": "i-1",
        "archetype": "numeric",
    } in values
    # locale fallback to en + multiple-choice answer text resolved →
    # `response_ids` present, so the classifier marks it categorical.
    assert {
        "label": "Feeling ok?",
        "value": None,
        "unit": None,
        "response_texts": ["Ja"],
        "item_id": "item-q",
        "instrument_id": "i-1",
        "archetype": "categorical",
    } in values
    # unknown item degrades to raw value with null label/unit; classifier
    # routes it to `free_text` (non-empty value, no unit, no response_ids).
    assert {
        "label": None,
        "value": "raw-only",
        "unit": None,
        "response_texts": [],
        "item_id": "item-unknown",
        "instrument_id": "i-1",
        "archetype": "free_text",
    } in values
    assert actions["pa-2"]["measurement"] is None

    unmatched_ids = [m["measurement_id"] for m in body["unmatched_measurements"]]
    assert unmatched_ids == ["m-2"]  # m-other belongs to another Luscii patient
    # Labels resolve from the synced tables — the request path must not
    # sweep the 95k-row upstream catalogues.
    assert not any("localisation" in c for c in luscii.calls)

    # ── series[] block: time-projected per (instrument_id, item_id). ──
    series = body["series"]
    assert isinstance(series, list)
    by_pair = {(s["instrument_id"], s["item_id"]): s for s in series}
    # Both decoded measurements (m-1, m-2) target the same instrument-item
    # for the weight value; the series merges them.
    weight = by_pair[("i-1", "item-w")]
    assert weight["archetype"] == "numeric"
    assert weight["unit"] == "kg"
    assert weight["instrument_name"] == "Gewicht meting"
    # m-1 contributes one weight value; m-2 has empty details. Lock to the
    # exact count so a future fixture/projection regression surfaces.
    assert len(weight["points"]) == 1
    weight_observed = [p["observed_at"] for p in weight["points"]]
    assert weight_observed == sorted(weight_observed), "points within a series MUST be sorted ASC"
    for point in weight["points"]:
        assert point["archetype"] == "numeric"
        assert isinstance(point["value"], (int, float))
    # The categorical questionnaire item lands as a `categorical` series.
    mc = by_pair[("i-1", "item-q")]
    assert mc["archetype"] == "categorical"
    assert mc["unit"] is None
    assert mc["points"][0]["archetype"] == "categorical"
    assert mc["points"][0]["responses"] == ["Ja"]
    # Series sort is DESC by most-recent point timestamp (D-LAYOUT).
    most_recent = [s["points"][-1]["observed_at"] for s in series]
    assert most_recent == sorted(most_recent, reverse=True), (
        "series MUST be sorted DESC by most-recent point"
    )
    # Every point in the response carries the current programme id (D-PROGRAM).
    expected_program_id = body["program"]["id"]
    for s in series:
        for point in s["points"]:
            assert point.get("program_id") == expected_program_id
    # series_id is a 12-char hex hash (no need to recompute; stability is
    # covered by the unit test on compute_series_id).
    assert all(len(s["series_id"]) == 12 for s in series)


async def test_luscii_data_not_linked_short_circuits(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(_data_url(seeded_zas_patients[0]))
    assert response.status_code == 200
    assert response.json()["state"] == "not_linked"
    assert luscii.calls == []  # no upstream calls for unlinked patients


async def test_luscii_data_not_linked_works_unconfigured(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    app: FastAPI,
) -> None:
    app.state.luscii_client = None
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(_data_url(seeded_zas_patients[0]))
    assert response.status_code == 200
    assert response.json()["state"] == "not_linked"


async def test_luscii_data_upstream_failure_returns_502(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    patient = seeded_zas_patients[0]
    await _login(async_client, ADMIN_EMAIL)
    await async_client.put(_link_url(patient), json={"luscii_patient_id": LUSCII_ID})
    luscii.fail = True
    response = await async_client.get(_data_url(patient))
    assert response.status_code == 502
    assert response.json()["code"] == "unavailable.luscii.upstream"


async def test_luscii_data_days_bounds(
    async_client: AsyncClient,
    seeded_zas_patients: list[Patient],
    luscii: FakeLusciiClient,
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(_data_url(seeded_zas_patients[0]), params={"days": 400})
    assert response.status_code == 422
