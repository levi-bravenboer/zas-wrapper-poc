"""Thin async client for the Ory Keto read + write APIs.

Keto is the Access Management Engine: relation tuples derived from
Postgres (see `app/services/access/sync/`) answer per-object permission
checks. Subjects are flat `User:<uuid>` strings; namespaces and permits
are defined in `infra/ory/keto/namespaces.keto.ts`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import httpx

from app.core.settings import Settings

KetoNamespace = Literal["Organisation", "CareTeam", "Patient", "Specialism", "Carepath"]


class KetoError(RuntimeError):
    """Keto answered with an unexpected status — infrastructure, not user error."""


@dataclass(frozen=True)
class SubjectSet:
    """Namespaced subject reference — required for relations that traverse
    (org parent chains, care-team membership). Flat `subject_id` strings
    only support direct equality."""

    namespace: str
    object_id: str
    relation: str = ""


@dataclass(frozen=True)
class RelationTuple:
    namespace: KetoNamespace
    object_id: str
    relation: str
    subject_id: str | None = None
    subject_set: SubjectSet | None = None

    def __post_init__(self) -> None:
        if (self.subject_id is None) == (self.subject_set is None):
            raise ValueError("exactly one of subject_id / subject_set must be set")

    def as_json(self) -> dict[str, object]:
        body: dict[str, object] = {
            "namespace": self.namespace,
            "object": self.object_id,
            "relation": self.relation,
        }
        if self.subject_id is not None:
            body["subject_id"] = self.subject_id
        else:
            assert self.subject_set is not None
            body["subject_set"] = {
                "namespace": self.subject_set.namespace,
                "object": self.subject_set.object_id,
                "relation": self.subject_set.relation,
            }
        return body

    def as_params(self) -> dict[str, str]:
        params = {
            "namespace": self.namespace,
            "object": self.object_id,
            "relation": self.relation,
        }
        if self.subject_id is not None:
            params["subject_id"] = self.subject_id
        else:
            assert self.subject_set is not None
            params["subject_set.namespace"] = self.subject_set.namespace
            params["subject_set.object"] = self.subject_set.object_id
            params["subject_set.relation"] = self.subject_set.relation
        return params


def user_subject(user_id: object) -> str:
    return f"User:{user_id}"


class KetoClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self._read = str(settings.keto_read_url).rstrip("/")
        self._write = str(settings.keto_write_url).rstrip("/")
        self._http = http

    # ── read API ────────────────────────────────────────────────────────

    async def check(
        self,
        *,
        namespace: KetoNamespace,
        object_id: str,
        relation: str,
        subject_id: str,
    ) -> bool:
        """Permission check. Keto answers 200 `{"allowed": true}` for allow
        and 403 `{"allowed": false}` for deny — both are valid outcomes."""

        response = await self._http.post(
            f"{self._read}/relation-tuples/check",
            json={
                "namespace": namespace,
                "object": object_id,
                "relation": relation,
                "subject_id": subject_id,
            },
        )
        if response.status_code in (200, 403):
            return bool(response.json().get("allowed", False))
        raise KetoError(f"check returned {response.status_code}")

    async def query_tuples(
        self,
        *,
        namespace: KetoNamespace,
        object_id: str | None = None,
        relation: str | None = None,
    ) -> list[RelationTuple]:
        """List direct tuples matching the filter (paginated under the hood)."""

        tuples: list[RelationTuple] = []
        page_token: str | None = None
        while True:
            params: dict[str, str] = {"namespace": namespace, "page_size": "500"}
            if object_id is not None:
                params["object"] = object_id
            if relation is not None:
                params["relation"] = relation
            if page_token:
                params["page_token"] = page_token
            response = await self._http.get(f"{self._read}/relation-tuples", params=params)
            if response.status_code != 200:
                raise KetoError(f"tuple query returned {response.status_code}")
            body = response.json()
            for item in body.get("relation_tuples", []):
                subject_set_payload = item.get("subject_set")
                tuples.append(
                    RelationTuple(
                        namespace=item["namespace"],
                        object_id=item["object"],
                        relation=item["relation"],
                        subject_id=item.get("subject_id"),
                        subject_set=(
                            SubjectSet(
                                namespace=subject_set_payload["namespace"],
                                object_id=subject_set_payload["object"],
                                relation=subject_set_payload.get("relation", ""),
                            )
                            if subject_set_payload is not None
                            else None
                        ),
                    )
                )
            page_token = body.get("next_page_token") or None
            if not page_token:
                return tuples

    # ── write API ───────────────────────────────────────────────────────

    async def insert_tuple(self, relation_tuple: RelationTuple) -> None:
        response = await self._http.put(
            f"{self._write}/admin/relation-tuples",
            json=relation_tuple.as_json(),
        )
        if response.status_code not in (200, 201):
            raise KetoError(f"tuple insert returned {response.status_code}: {response.text}")

    async def delete_tuple(self, relation_tuple: RelationTuple) -> None:
        response = await self._http.delete(
            f"{self._write}/admin/relation-tuples",
            params=relation_tuple.as_params(),
        )
        if response.status_code not in (204, 404):
            raise KetoError(f"tuple delete returned {response.status_code}")
