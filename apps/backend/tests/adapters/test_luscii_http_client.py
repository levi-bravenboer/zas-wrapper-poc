"""LusciiHttpClient unit tests — httpx.MockTransport, no network."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from app.adapters.luscii import (
    LusciiApiError,
    LusciiHttpClient,
    LusciiPatientNotFoundError,
)

TOKEN = "secret-luscii-token"  # noqa: S105 — synthetic test value
START = date(2026, 5, 11)
END = date(2026, 6, 10)


def _client(handler: httpx.MockTransport) -> LusciiHttpClient:
    return LusciiHttpClient("https://vitals.test", SecretStr(TOKEN), transport=handler)


def _page(rows: list[dict[str, Any]], next_cursor: str | None) -> httpx.Response:
    return httpx.Response(
        200, json={"data": rows, "meta": {"perPage": 100, "nextCursor": next_cursor}}
    )


def _planned_action(idx: int) -> dict[str, Any]:
    return {
        "id": f"00000000-0000-0000-0000-{idx:012d}",
        "programActionId": "11111111-1111-1111-1111-111111111111",
        "patientId": "22222222-2222-2222-2222-222222222222",
        "selfPlanned": False,
        "notBefore": "2026-06-01T08:00:00+00:00",
        "expiresAt": "2026-06-02T08:00:00+00:00",
        "completedAt": None,
        "createdAt": "2026-05-30T12:00:00+00:00",
    }


async def test_bearer_header_sent_and_pagination_exhausted() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        cursor = request.url.params.get("cursor")
        if cursor is None:
            return _page([_planned_action(1), _planned_action(2)], "cursor-2")
        assert cursor == "cursor-2"
        return _page([_planned_action(3)], None)

    client = _client(httpx.MockTransport(handler))
    rows = await client.get_planned_actions("22222222-2222-2222-2222-222222222222", START, END)

    assert [r.id[-1] for r in rows] == ["1", "2", "3"]
    assert len(seen) == 2
    assert all(r.headers["Authorization"] == f"Bearer {TOKEN}" for r in seen)
    assert seen[0].url.params["startDate"] == "2026-05-11"
    assert seen[0].url.params["endDate"] == "2026-06-10"
    assert seen[0].url.params["perPage"] == "100"


async def test_page_cap_overrun_raises_instead_of_truncating() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _page([_planned_action(1)], "always-more")

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(LusciiApiError, match="refusing to truncate"):
        await client.get_planned_actions("22222222-2222-2222-2222-222222222222", START, END)


async def test_upstream_500_maps_to_typed_error_without_leaking() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text=f"internal dump including {TOKEN}")

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(LusciiApiError) as excinfo:
        await client.get_measurements(START, END)

    assert excinfo.value.status_code == 500
    assert TOKEN not in str(excinfo.value)
    assert "internal dump" not in str(excinfo.value)


async def test_transport_failure_maps_to_typed_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(LusciiApiError, match="transport failure"):
        await client.ping()


async def test_get_patient_parses_program_and_protocol() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/patients/abc-123"
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "abc-123",
                    "status": "active",
                    "firstName": "should-be-ignored",
                    "program": {
                        "id": "p-1",
                        "name": "Heart Failure Program",
                        "startDate": "2026-04-01",
                    },
                    "protocol": {"id": "pr-1", "name": "Intake protocol"},
                }
            },
        )

    client = _client(httpx.MockTransport(handler))
    patient = await client.get_patient("abc-123")

    assert patient.id == "abc-123"
    assert patient.program is not None and patient.program.name == "Heart Failure Program"
    assert patient.protocol is not None and patient.protocol.name == "Intake protocol"
    # Demographic fields are not modelled (display-only invariant).
    assert not hasattr(patient, "first_name")


@pytest.mark.parametrize("status", [403, 404])
async def test_get_patient_not_found_and_forbidden(status: int) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"message": "nope"})

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(LusciiPatientNotFoundError) as excinfo:
        await client.get_patient("missing-id")
    assert excinfo.value.status_code == status


async def test_measurements_parse_with_details_string() -> None:
    details = json.dumps(
        [
            {
                "item_id": "item-1",
                "item_version": "item-1",
                "value": "151",
                "response_ids": [],
                "file_name": None,
            }
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return _page(
            [
                {
                    "measurementId": "m-1",
                    "patientId": "22222222-2222-2222-2222-222222222222",
                    "plannedActionId": None,
                    "instrumentId": "i-1",
                    "instrumentVersion": "iv-1",
                    "createdAt": "2026-06-01T09:00:00+00:00",
                    "details": details,
                }
            ],
            None,
        )

    client = _client(httpx.MockTransport(handler))
    rows = await client.get_measurements(START, END)

    assert len(rows) == 1
    assert rows[0].measurement_id == "m-1"
    assert rows[0].planned_action_id is None
    assert json.loads(rows[0].details)[0]["value"] == "151"


async def test_malformed_payload_raises_validation_error_without_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _page([{"unexpected": "shape"}], None)

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(LusciiApiError, match="validation"):
        await client.get_measurements(START, END)
