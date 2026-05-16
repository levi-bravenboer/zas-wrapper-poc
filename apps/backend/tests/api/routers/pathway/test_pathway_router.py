from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.db.models.pathway import PathwayLaneKind
from scripts.seed_users import ADMIN_EMAIL

_PASSWORD = "changeme"


async def _login(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": ADMIN_EMAIL, "password": _PASSWORD}
    )
    assert response.status_code == 200, response.text


async def _create(client: AsyncClient, name: str = "Test") -> dict:
    response = await client.post(
        "/pathways",
        json={
            "name": name,
            "clinical_goal": "Restore function within 12 weeks.",
            "patient_goal": "Return to running by spring.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _replace_payload(name: str, lane_kinds: dict[str, PathwayLaneKind]) -> dict:
    del lane_kinds
    phase_id = str(uuid.uuid4())
    lane_id = str(uuid.uuid4())
    block_id = str(uuid.uuid4())
    return {
        "name": name,
        "phases": [{"id": phase_id, "template_id": "pre-op", "label": "Pre-op", "ord": 0}],
        "lanes": [
            {
                "id": lane_id,
                "lane_kind_code": "caregiver",
                "label": "Caregiver",
                "ord": 0,
                "is_default": True,
            }
        ],
        "blocks": [
            {
                "id": block_id,
                "phase_id": phase_id,
                "lane_id": lane_id,
                "type": "appointment",
                "label": "Intake",
                "config": {"title": "Intake"},
            }
        ],
    }


async def test_endpoints_require_auth(async_client: AsyncClient) -> None:
    for path in (
        "/pathways",
        "/pathways/blocks",
        "/pathways/phase-templates",
    ):
        response = await async_client.get(path)
        assert response.status_code == 401, f"{path}: {response.status_code}"


async def test_list_block_types(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.get("/pathways/blocks")

    assert response.status_code == 200
    rows = response.json()
    codes = {row["type"] for row in rows}
    assert {"appointment", "decision", "milestone", "timer", "task", "email"}.issubset(codes)
    lane_codes = {row["default_lane_kind_code"] for row in rows}
    assert lane_codes <= {"patient", "caregiver", "system", "external"}


async def test_list_phase_templates(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.get("/pathways/phase-templates")

    assert response.status_code == 200
    assert len(response.json()) > 0


async def test_create_pathway_returns_definition(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.post(
        "/pathways",
        json={
            "name": "Brand new",
            "clinical_goal": "Reduce post-op pain to <3 NRS by week 6.",
            "patient_goal": "Walk pain-free with my grandkids.",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Brand new"
    assert body["clinical_goal"] == "Reduce post-op pain to <3 NRS by week 6."
    assert body["patient_goal"] == "Walk pain-free with my grandkids."
    assert body["blocks"] == []


async def test_list_pathways_includes_created(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client, name="Listed")

    response = await async_client.get("/pathways")

    assert response.status_code == 200
    ids = [row["id"] for row in response.json()]
    assert created["id"] in ids


async def test_get_pathway_round_trip(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)

    response = await async_client.get(f"/pathways/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


async def test_get_unknown_pathway_returns_404(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.get(f"/pathways/{uuid.uuid4()}")

    assert response.status_code == 404


async def test_replace_pathway_overwrites(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    await _login(async_client)
    created = await _create(async_client, name="Before")

    payload = _replace_payload("After", lane_kinds)
    response = await async_client.put(f"/pathways/{created['id']}", json=payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "After"
    assert len(body["blocks"]) == 1
    assert len(body["phases"]) == 1
    assert len(body["lanes"]) == 1


async def test_replace_unknown_pathway_returns_404(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    await _login(async_client)

    payload = _replace_payload("Missing", lane_kinds)
    response = await async_client.put(f"/pathways/{uuid.uuid4()}", json=payload)

    assert response.status_code == 404


async def test_replace_invalid_payload_returns_422(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    await _login(async_client)
    created = await _create(async_client)

    payload = _replace_payload("Bad", lane_kinds)
    payload["blocks"][0]["type"] = "not-a-real-block-type"

    response = await async_client.put(f"/pathways/{created['id']}", json=payload)

    assert response.status_code == 422


async def test_delete_pathway_returns_204_and_hides_from_list(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)

    response = await async_client.delete(f"/pathways/{created['id']}")
    assert response.status_code == 204

    listing = await async_client.get("/pathways")
    ids = [row["id"] for row in listing.json()]
    assert created["id"] not in ids


async def test_delete_unknown_pathway_returns_404(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.delete(f"/pathways/{uuid.uuid4()}")

    assert response.status_code == 404
