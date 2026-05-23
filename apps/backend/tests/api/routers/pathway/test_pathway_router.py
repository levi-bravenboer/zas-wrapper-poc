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
        "/pathways/edge-timing-kinds",
        "/pathways/edge-offset-directions",
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
    assert codes == {
        "appointment",
        "task",
        "message",
        "form",
        "decision",
        "milestone",
        "wait",
        "pathway_link",
        "luscii.program",
    }
    for row in rows:
        assert row["semantics"] in {
            "appointment",
            "task",
            "message",
            "form",
            "decision",
            "milestone",
            "wait",
            "pathway_link",
            "external_program",
        }
        assert isinstance(row["icon"], str) and row["icon"]
        assert isinstance(row["ui_schema"], dict)
        lane_codes = row["allowed_lane_kind_codes"]
        assert isinstance(lane_codes, list) and len(lane_codes) >= 1
        for code in lane_codes:
            assert code in {"patient", "caregiver", "system", "external"}
        assert row["source"] in {"native", "external"}
        if row["source"] == "external":
            assert row["provider"] and row["kind"]
        else:
            assert row["provider"] is None
            assert row["kind"] is None


async def test_list_phase_templates(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.get("/pathways/phase-templates")

    assert response.status_code == 200
    assert len(response.json()) > 0


async def test_list_edge_timing_kinds(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.get("/pathways/edge-timing-kinds")

    assert response.status_code == 200
    rows = response.json()
    kinds = {row["kind"] for row in rows}
    assert kinds == {"completion", "marker", "immediate", "branch"}
    for row in rows:
        assert isinstance(row["label"], str) and row["label"]
        assert row["config_schema"]["type"] == "object"
        assert isinstance(row["ui_schema"], dict)


async def test_list_edge_offset_directions(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.get("/pathways/edge-offset-directions")

    assert response.status_code == 200
    rows = response.json()
    codes = {row["code"] for row in rows}
    assert {"before", "after"}.issubset(codes)
    for row in rows:
        assert isinstance(row["label"], str) and row["label"]
        assert isinstance(row["ord"], int)


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
    assert body["pathway"]["name"] == "Brand new"
    assert body["pathway"]["clinical_goal"] == "Reduce post-op pain to <3 NRS by week 6."
    assert body["pathway"]["patient_goal"] == "Walk pain-free with my grandkids."
    assert body["version"]["status"] == "concept"
    assert body["version"]["kind"] == "initial"
    assert body["version"]["blocks"] == []


async def test_list_pathways_includes_created(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client, name="Listed")

    response = await async_client.get("/pathways")

    assert response.status_code == 200
    rows = response.json()
    ids = [row["id"] for row in rows]
    assert created["pathway"]["id"] in ids
    row = next(r for r in rows if r["id"] == created["pathway"]["id"])
    assert row["has_concept"] is True
    assert row["latest_published_version_id"] is None


async def test_get_pathway_round_trip(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)

    response = await async_client.get(f"/pathways/{created['pathway']['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["pathway"]["id"] == created["pathway"]["id"]
    assert body["version"]["id"] == created["version"]["id"]


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
    response = await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["pathway"]["name"] == "After"
    assert len(body["version"]["blocks"]) == 1
    assert len(body["version"]["phases"]) == 1
    assert len(body["version"]["lanes"]) == 1


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

    response = await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)

    assert response.status_code == 422


async def test_replace_disallowed_lane_returns_422(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    """message block on caregiver lane violates allowed_lane_kind_codes."""

    await _login(async_client)
    created = await _create(async_client)

    payload = _replace_payload("Bad lane", lane_kinds)
    payload["blocks"][0]["type"] = "message"
    payload["blocks"][0]["config"] = {
        "channel": "email",
        "subject": "Hi",
        "body": "Welcome",
    }
    # lane stays on caregiver — message allows only patient.

    response = await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)

    assert response.status_code == 422, response.text
    body = response.json()
    details = body["details"]
    assert details["block_id"] == payload["blocks"][0]["id"]
    assert details["lane_kind_code"] == "caregiver"
    assert details["allowed_lane_kind_codes"] == ["patient"]


async def test_replace_invalid_edge_timing_returns_422(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    """Edge with both delay_value_id and time_marker_id set → 422."""

    await _login(async_client)
    created = await _create(async_client)

    payload = _replace_payload("Bad timing", lane_kinds)
    second_block_id = str(uuid.uuid4())
    delay_id = str(uuid.uuid4())
    marker_id = str(uuid.uuid4())
    marker_value_id = str(uuid.uuid4())
    payload["blocks"].append(
        {
            "id": second_block_id,
            "phase_id": payload["blocks"][0]["phase_id"],
            "lane_id": payload["blocks"][0]["lane_id"],
            "type": "appointment",
            "label": "Follow-up",
            "config": {"title": "Follow-up"},
        }
    )
    payload["timing_values"] = [
        {"id": delay_id, "kind": "fixed", "fixed_days": 3},
        {"id": marker_value_id, "kind": "fixed", "fixed_days": 0},
    ]
    payload["time_markers"] = [{"id": marker_id, "value_id": marker_value_id, "label": "Surgery"}]
    payload["edges"] = [
        {
            "id": str(uuid.uuid4()),
            "source_block_id": payload["blocks"][0]["id"],
            "target_block_id": second_block_id,
            "delay_value_id": delay_id,
            "time_marker_id": marker_id,
            "offset_value_id": marker_value_id,
            "offset_direction_code": "after",
        }
    ]

    response = await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)

    assert response.status_code == 422, response.text
    body = response.json()
    assert body["details"]["edge_id"] == payload["edges"][0]["id"]


async def test_delete_pathway_returns_204_and_hides_from_list(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)

    response = await async_client.delete(f"/pathways/{created['pathway']['id']}")
    assert response.status_code == 204

    listing = await async_client.get("/pathways")
    ids = [row["id"] for row in listing.json()]
    assert created["pathway"]["id"] not in ids


async def test_delete_unknown_pathway_returns_404(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)

    response = await async_client.delete(f"/pathways/{uuid.uuid4()}")

    assert response.status_code == 404


# ---------- Version lifecycle endpoints --------------------------------------


async def test_list_versions_empty_concept_only(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)

    response = await async_client.get(f"/pathways/{created['pathway']['id']}/versions")

    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 1
    assert versions[0]["status"] == "concept"
    assert versions[0]["kind"] == "initial"


async def test_publish_promotes_concept_to_published(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    await _login(async_client)
    created = await _create(async_client)
    payload = _replace_payload("To publish", lane_kinds)
    await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)

    response = await async_client.post(
        f"/pathways/{created['pathway']['id']}/publish",
        json={"clinically_approved": True, "label": "v1"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "published"
    assert body["label"] == "v1"


async def test_publish_without_approval_returns_422(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)

    response = await async_client.post(
        f"/pathways/{created['pathway']['id']}/publish",
        json={"clinically_approved": False},
    )

    assert response.status_code == 422


async def test_publish_without_concept_returns_409(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    """After publishing, the concept is gone → second publish must 409."""

    await _login(async_client)
    created = await _create(async_client)
    payload = _replace_payload("Once", lane_kinds)
    await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)
    first = await async_client.post(
        f"/pathways/{created['pathway']['id']}/publish",
        json={"clinically_approved": True},
    )
    assert first.status_code == 200, first.text

    second = await async_client.post(
        f"/pathways/{created['pathway']['id']}/publish",
        json={"clinically_approved": True},
    )

    assert second.status_code == 409


async def test_fork_from_publish_requires_published_source(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    """Source must be `published` for fork-from-publish — otherwise 422."""

    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)
    concept_id = created["version"]["id"]

    response = await async_client.post(
        f"/pathways/{created['pathway']['id']}/versions/{concept_id}/fork-from-publish",
    )

    assert response.status_code == 422


async def test_restore_creates_new_concept_from_published(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    await _login(async_client)
    created = await _create(async_client)
    payload = _replace_payload("Restorable", lane_kinds)
    put_resp = await async_client.put(f"/pathways/{created['pathway']['id']}", json=payload)
    assert put_resp.status_code == 200, put_resp.text
    publish = await async_client.post(
        f"/pathways/{created['pathway']['id']}/publish",
        json={"clinically_approved": True},
    )
    assert publish.status_code == 200, publish.text
    published_version_id = publish.json()["id"]

    response = await async_client.post(
        f"/pathways/{created['pathway']['id']}/versions/{published_version_id}/restore",
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "concept"
    assert body["kind"] == "restore-from-version"
    assert body["derived_from_version_id"] == published_version_id


async def test_restore_blocked_by_existing_concept(
    async_client: AsyncClient, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    """Restore must 409 if a concept already exists (one-concept invariant)."""

    del lane_kinds
    await _login(async_client)
    created = await _create(async_client)
    concept_id = created["version"]["id"]

    response = await async_client.post(
        f"/pathways/{created['pathway']['id']}/versions/{concept_id}/restore",
    )

    assert response.status_code == 409
