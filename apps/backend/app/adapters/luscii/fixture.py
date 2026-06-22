# POC ONLY — local-development Luscii client returning canned data so the
# chart UI demos without a real bearer token. Replace with the real-token
# `LusciiHttpClient` (already in production code path) at MVP. The factory
# in `adapters/deps.py` engages this client only when no token is set AND
# `BACKEND_LUSCII_FIXTURES=true`.
"""Local-development Luscii client returning canned data.

Toggled by `BACKEND_LUSCII_FIXTURES=true` when no API token is configured.
The factory in `adapters/deps.py` swaps the live `LusciiHttpClient` for a
`LusciiFixtureClient` when the flag is set; localisation snapshots come
from the regular catalogue snapshot loader (`seed_all` step), plus a
fixture-specific seed step that adds rows for the instruments + items this
module emits (see `scripts/seed_luscii_demo.py`).

DEMO ONLY — never wire this into production. Patient demographics, vitals,
and questionnaire answers are synthetic.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from random import Random
from typing import Final

from app.adapters.luscii.api_models import (
    LusciiAlert,
    LusciiInstrumentItemLocalisation,
    LusciiInstrumentLocalisation,
    LusciiItemResponseLocalisation,
    LusciiMeasurement,
    LusciiPatientDetails,
    LusciiPlannedAction,
    LusciiProgramRef,
    LusciiProtocolRef,
)
from app.adapters.luscii.errors import LusciiPatientNotFoundError

# ── Public ids — these MUST match the demo seed (scripts/seed_luscii_demo.py).
# Pick stable UUIDs so caregivers always land on the same demo set.

FIXTURE_PROGRAMME_ID: Final[str] = "fa11c0c0-0000-4000-8000-000000000abc"
FIXTURE_PROGRAMME_NAME: Final[str] = "ZAS Hartfalen Monitor"
FIXTURE_PROTOCOL_ID: Final[str] = "fa11c0c0-0000-4000-8000-000000000def"
FIXTURE_PROTOCOL_NAME: Final[str] = "Intake + dagelijkse monitoring"

# Instrument ids — `INST_<NAME>`. Versions are `iv-1` everywhere.
INST_BP: Final[str] = "fa11c0c0-1111-4111-8111-bbbbbbbb0001"
INST_WEIGHT: Final[str] = "fa11c0c0-1111-4111-8111-bbbbbbbb0002"
INST_KLACHTEN: Final[str] = "fa11c0c0-1111-4111-8111-bbbbbbbb0003"
INST_WELBEVINDEN: Final[str] = "fa11c0c0-1111-4111-8111-bbbbbbbb0004"
INSTRUMENT_VERSION: Final[str] = "iv-1"

# Item ids inside each instrument.
ITEM_SYS: Final[str] = "fa11c0c0-2222-4222-8222-aaaaaaaa0001"
ITEM_DIA: Final[str] = "fa11c0c0-2222-4222-8222-aaaaaaaa0002"
ITEM_WEIGHT: Final[str] = "fa11c0c0-2222-4222-8222-aaaaaaaa0003"
ITEM_KLACHTEN: Final[str] = "fa11c0c0-2222-4222-8222-aaaaaaaa0004"
ITEM_WELBEVINDEN: Final[str] = "fa11c0c0-2222-4222-8222-aaaaaaaa0005"
ITEM_VERSION: Final[str] = "v1"

# Response ids for the Klachten questionnaire (categorical).
RESP_VERMOEIDHEID: Final[str] = "fa11c0c0-3333-4333-8333-cccccccc0001"
RESP_KORTADEMIGHEID: Final[str] = "fa11c0c0-3333-4333-8333-cccccccc0002"
RESP_PIJN_BORST: Final[str] = "fa11c0c0-3333-4333-8333-cccccccc0003"
RESP_GEEN: Final[str] = "fa11c0c0-3333-4333-8333-cccccccc0004"

# Fixture patient roster. Each (luscii_id, seed) gives a deterministic
# 30-day measurement set. Add entries here to expose more demo patients.
FIXTURE_PATIENTS: Final[tuple[tuple[str, int], ...]] = (
    ("fa11c001-1111-4111-8111-111111111111", 1),
    ("fa11c002-2222-4222-8222-222222222222", 2),
    ("fa11c003-3333-4333-8333-333333333333", 3),
    ("fa11c004-4444-4444-8444-444444444444", 4),
)
_KNOWN_IDS: Final[frozenset[str]] = frozenset(pid for pid, _ in FIXTURE_PATIENTS)


# ── Localisation rows the fixture client emits + the seed step persists.
#    Tuples kept as data so the seed script can iterate without re-importing
#    the fixture's measurement-generation machinery.

INSTRUMENT_LOCALISATIONS_NL: Final[tuple[tuple[str, str, str], ...]] = (
    (INST_BP, INSTRUMENT_VERSION, "Bloeddrukmeting"),
    (INST_WEIGHT, INSTRUMENT_VERSION, "Gewicht"),
    (INST_KLACHTEN, INSTRUMENT_VERSION, "Klachten dagboek"),
    (INST_WELBEVINDEN, INSTRUMENT_VERSION, "Welbevinden vandaag"),
)

ITEM_LOCALISATIONS_NL: Final[tuple[tuple[str, str, str, str | None], ...]] = (
    (ITEM_SYS, ITEM_VERSION, "Systolisch", "mmHg"),
    (ITEM_DIA, ITEM_VERSION, "Diastolisch", "mmHg"),
    (ITEM_WEIGHT, ITEM_VERSION, "Gewicht", "kg"),
    (ITEM_KLACHTEN, ITEM_VERSION, "Klachten", None),
    (ITEM_WELBEVINDEN, ITEM_VERSION, "Welbevinden", "Punten"),
)

RESPONSE_LOCALISATIONS_NL: Final[tuple[tuple[str, str], ...]] = (
    (RESP_VERMOEIDHEID, "Vermoeidheid"),
    (RESP_KORTADEMIGHEID, "Kortademigheid"),
    (RESP_PIJN_BORST, "Pijn op de borst"),
    (RESP_GEEN, "Geen klachten"),
)


@dataclass(frozen=True, slots=True)
class _Snapshot:
    """All canned data for a single fixture patient."""

    details: LusciiPatientDetails
    planned_actions: tuple[LusciiPlannedAction, ...]
    measurements: tuple[LusciiMeasurement, ...]


def _now() -> datetime:
    return datetime.now(UTC)


def _build_snapshot(luscii_patient_id: str, seed: int) -> _Snapshot:
    """Procedurally generate 30 days of canned measurements for a patient."""

    rng = Random(seed)
    now = _now()
    measurements: list[LusciiMeasurement] = []
    planned_actions: list[LusciiPlannedAction] = []

    for day_offset in range(30, 0, -1):
        ts = now - timedelta(days=day_offset - 1, hours=rng.randint(0, 2))

        # Blood pressure — sys + dia, drift around 120/80, daily.
        sys_value = rng.randint(115, 145)
        dia_value = rng.randint(70, 92)
        measurements.append(
            _make_measurement(
                luscii_patient_id,
                instrument_id=INST_BP,
                ts=ts,
                details=[
                    {"item_id": ITEM_SYS, "item_version": ITEM_VERSION, "value": str(sys_value)},
                    {"item_id": ITEM_DIA, "item_version": ITEM_VERSION, "value": str(dia_value)},
                ],
                seq=day_offset * 10 + 1,
            )
        )

        # Weight — daily, drift gently around 79kg.
        weight_value = round(79.0 + rng.uniform(-1.5, 1.5), 1)
        measurements.append(
            _make_measurement(
                luscii_patient_id,
                instrument_id=INST_WEIGHT,
                ts=ts.replace(hour=7, minute=30, second=0, microsecond=0),
                details=[
                    {
                        "item_id": ITEM_WEIGHT,
                        "item_version": ITEM_VERSION,
                        "value": f"{weight_value}".replace(".", ","),
                    }
                ],
                seq=day_offset * 10 + 2,
            )
        )

        # Klachten — every 3rd day, multiple choice.
        if day_offset % 3 == 0:
            picked = rng.sample(
                [RESP_VERMOEIDHEID, RESP_KORTADEMIGHEID, RESP_PIJN_BORST],
                k=rng.randint(1, 2),
            )
            measurements.append(
                _make_measurement(
                    luscii_patient_id,
                    instrument_id=INST_KLACHTEN,
                    ts=ts.replace(hour=20, minute=15, second=0, microsecond=0),
                    details=[
                        {
                            "item_id": ITEM_KLACHTEN,
                            "item_version": ITEM_VERSION,
                            "response_ids": picked,
                        }
                    ],
                    seq=day_offset * 10 + 3,
                )
            )

        # Welbevinden — every 2nd day, 1-5 score.
        if day_offset % 2 == 0:
            score = rng.randint(2, 5)
            measurements.append(
                _make_measurement(
                    luscii_patient_id,
                    instrument_id=INST_WELBEVINDEN,
                    ts=ts.replace(hour=20, minute=30, second=0, microsecond=0),
                    details=[
                        {
                            "item_id": ITEM_WELBEVINDEN,
                            "item_version": ITEM_VERSION,
                            "value": str(score),
                        }
                    ],
                    seq=day_offset * 10 + 4,
                )
            )

        # A planned action every ~5 days (some completed, some open).
        if day_offset % 5 == 0:
            planned_actions.append(
                LusciiPlannedAction(
                    id=f"pa-{luscii_patient_id[:8]}-{day_offset}",
                    program_action_id=None,
                    patient_id=luscii_patient_id,
                    self_planned=False,
                    not_before=ts.replace(hour=8, minute=0, second=0, microsecond=0),
                    expires_at=ts.replace(hour=22, minute=0, second=0, microsecond=0),
                    completed_at=ts.replace(hour=8, minute=12, second=0, microsecond=0)
                    if day_offset > 7
                    else None,
                    created_at=ts - timedelta(days=1),
                )
            )

    details = LusciiPatientDetails(
        id=luscii_patient_id,
        status="active",
        program=LusciiProgramRef(
            id=FIXTURE_PROGRAMME_ID,
            name=FIXTURE_PROGRAMME_NAME,
            start_date=date.today() - timedelta(days=60),
        ),
        protocol=LusciiProtocolRef(id=FIXTURE_PROTOCOL_ID, name=FIXTURE_PROTOCOL_NAME),
    )
    return _Snapshot(
        details=details,
        planned_actions=tuple(planned_actions),
        measurements=tuple(measurements),
    )


def _make_measurement(
    patient_id: str,
    *,
    instrument_id: str,
    ts: datetime,
    details: list[dict[str, object]],
    seq: int,
) -> LusciiMeasurement:
    return LusciiMeasurement(
        measurement_id=f"m-{patient_id[:8]}-{seq}",
        patient_id=patient_id,
        planned_action_id=None,
        instrument_id=instrument_id,
        instrument_version=INSTRUMENT_VERSION,
        processed_at=ts,
        created_at=ts,
        details=json.dumps(details),
    )


def _snapshots() -> dict[str, _Snapshot]:
    """Build every fixture patient's snapshot relative to NOW.

    Generated per-call so the 30-day window stays anchored to the current
    request time — a backend that's been running for a week still surfaces
    "today" measurements. Cost: ~5ms for 3 patients × ~120 rows each. The
    rng seed per patient keeps the resulting series deterministic between
    calls within the same second; the time anchor naturally shifts the
    window as wall-clock advances.
    """

    return {pid: _build_snapshot(pid, seed) for pid, seed in FIXTURE_PATIENTS}


class LusciiFixtureClient:
    """In-process fixture client matching the live `LusciiClient` Protocol."""

    async def ping(self) -> None:
        # Always healthy — fixture mode is always reachable.
        return None

    async def get_patient(self, luscii_patient_id: str) -> LusciiPatientDetails:
        snap = _snapshots().get(luscii_patient_id)
        if snap is None:
            raise LusciiPatientNotFoundError(luscii_patient_id, status_code=404)
        return snap.details

    async def get_planned_actions(
        self, luscii_patient_id: str, start_date: date, end_date: date
    ) -> list[LusciiPlannedAction]:
        snap = _snapshots().get(luscii_patient_id)
        if snap is None:
            raise LusciiPatientNotFoundError(luscii_patient_id, status_code=404)
        return list(_within_window(snap.planned_actions, start_date, end_date))

    async def get_measurements(self, start_date: date, end_date: date) -> list[LusciiMeasurement]:
        # Real Luscii returns org-wide; mimic by concatenating every fixture
        # patient's window.
        return [
            m
            for snap in _snapshots().values()
            for m in _within_window(snap.measurements, start_date, end_date)
        ]

    async def get_alerts(self, start_date: date, end_date: date) -> list[LusciiAlert]:
        # Fixture data carries no fired alerts; measurements render unflagged.
        del start_date, end_date
        return []

    async def get_instrument_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiInstrumentLocalisation]:
        del expected_total  # arg kept for Protocol parity, unused in fixture.
        return [
            LusciiInstrumentLocalisation(
                instrument_id=iid, instrument_version=ver, locale="nl", name=name
            )
            for iid, ver, name in INSTRUMENT_LOCALISATIONS_NL
        ]

    async def get_instrument_item_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiInstrumentItemLocalisation]:
        del expected_total
        return [
            LusciiInstrumentItemLocalisation(
                item_id=iid, item_version=ver, locale="nl", title=title, unit=unit
            )
            for iid, ver, title, unit in ITEM_LOCALISATIONS_NL
        ]

    async def get_item_response_localisations(
        self, *, expected_total: int | None = None
    ) -> list[LusciiItemResponseLocalisation]:
        del expected_total
        return [
            LusciiItemResponseLocalisation(item_response_id=rid, locale="nl", response_text=text)
            for rid, text in RESPONSE_LOCALISATIONS_NL
        ]

    async def aclose(self) -> None:
        # No pooled resources to release; matches the live client's interface.
        return None


def _within_window(
    items: Iterable[LusciiMeasurement | LusciiPlannedAction],
    start_date: date,
    end_date: date,
) -> list:
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=UTC)
    end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=UTC)
    in_window: list = []
    for item in items:
        ts = next(
            (
                candidate
                for candidate in (
                    getattr(item, "processed_at", None),
                    getattr(item, "created_at", None),
                    getattr(item, "not_before", None),
                )
                if candidate is not None
            ),
            None,
        )
        if ts is None or start_dt <= ts <= end_dt:
            in_window.append(item)
    return in_window


def is_fixture_patient_id(luscii_patient_id: str) -> bool:
    """True if the id matches one of the fixture patients."""
    return luscii_patient_id in _KNOWN_IDS
