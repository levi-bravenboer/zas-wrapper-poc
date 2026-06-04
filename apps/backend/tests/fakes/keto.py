"""In-memory stand-in for Ory Keto used by the test suite.

Stores relation tuples and evaluates the same permits the OPL config
(`infra/ory/keto/namespaces.keto.ts`) defines:

- `Organisation.view`     — member, or membership anywhere up the parent chain
- `Specialism` / `Carepath` — practitioner membership; carepath view =
  assigned ∪ specialism practitioners ∪ owner_org view
- `Patient.view_shielded` — care-team member, treating-org chain, break-glass
- `Patient.view`          — view_shielded ∪ external_reader
- `Patient.edit`          — care-team member ∪ break_glass ∪ external_writer
- `Patient.record`        — edit ∪ external_recorder
- `Patient.message`       — view ∪ external_messager

The real graph evaluation is proven live against Keto by
`infra/ory/smoke.sh` (CI `ory-smoke` job); this fake exists so backend
tests run without the ory compose slice.
"""

from __future__ import annotations

from app.services.access.permissions.keto_client import (
    KetoClient,
    KetoNamespace,
    RelationTuple,
)


class FakeKetoClient(KetoClient):
    def __init__(self) -> None:
        # Deliberately does NOT call KetoClient.__init__ — no HTTP here.
        self.tuples: set[RelationTuple] = set()

    # ── helpers ─────────────────────────────────────────────────────────

    def _subjects(self, namespace: str, object_id: str, relation: str) -> set[RelationTuple]:
        return {
            t
            for t in self.tuples
            if t.namespace == namespace and t.object_id == object_id and t.relation == relation
        }

    def _has_direct(self, namespace: str, object_id: str, relation: str, subject_id: str) -> bool:
        return any(
            t.subject_id == subject_id for t in self._subjects(namespace, object_id, relation)
        )

    def _org_view(self, org_id: str, subject_id: str, seen: set[str] | None = None) -> bool:
        seen = seen or set()
        if org_id in seen:
            return False
        seen.add(org_id)
        if self._has_direct("Organisation", org_id, "member", subject_id):
            return True
        for parent in self._subjects("Organisation", org_id, "parent"):
            if parent.subject_set is not None and self._org_view(
                parent.subject_set.object_id, subject_id, seen
            ):
                return True
        return False

    def _care_team_member(self, patient_id: str, subject_id: str) -> bool:
        return any(
            team.subject_set is not None
            and self._has_direct("CareTeam", team.subject_set.object_id, "member", subject_id)
            for team in self._subjects("Patient", patient_id, "care_team")
        )

    def _patient_view_shielded(self, patient_id: str, subject_id: str) -> bool:
        if self._care_team_member(patient_id, subject_id):
            return True
        for org in self._subjects("Patient", patient_id, "treating_org"):
            if org.subject_set is not None and self._org_view(
                org.subject_set.object_id, subject_id
            ):
                return True
        return self._has_direct("Patient", patient_id, "break_glass", subject_id)

    def _patient_edit(self, patient_id: str, subject_id: str) -> bool:
        return (
            self._care_team_member(patient_id, subject_id)
            or self._has_direct("Patient", patient_id, "break_glass", subject_id)
            or self._has_direct("Patient", patient_id, "external_writer", subject_id)
        )

    def _carepath_view(self, pathway_id: str, subject_id: str) -> bool:
        if self._has_direct("Carepath", pathway_id, "assigned", subject_id):
            return True
        for spec in self._subjects("Carepath", pathway_id, "specialism"):
            if spec.subject_set is not None and self._has_direct(
                "Specialism", spec.subject_set.object_id, "practitioner", subject_id
            ):
                return True
        return any(
            org.subject_set is not None and self._org_view(org.subject_set.object_id, subject_id)
            for org in self._subjects("Carepath", pathway_id, "owner_org")
        )

    # ── read API ────────────────────────────────────────────────────────

    async def check(
        self,
        *,
        namespace: KetoNamespace,
        object_id: str,
        relation: str,
        subject_id: str,
    ) -> bool:
        if namespace == "Patient":
            if relation == "view":
                return self._patient_view_shielded(object_id, subject_id) or self._has_direct(
                    "Patient", object_id, "external_reader", subject_id
                )
            if relation == "view_shielded":
                return self._patient_view_shielded(object_id, subject_id)
            if relation == "edit":
                return self._patient_edit(object_id, subject_id)
            if relation == "record":
                return self._patient_edit(object_id, subject_id) or self._has_direct(
                    "Patient", object_id, "external_recorder", subject_id
                )
            if relation == "message":
                return (
                    self._patient_view_shielded(object_id, subject_id)
                    or self._has_direct("Patient", object_id, "external_reader", subject_id)
                    or self._has_direct("Patient", object_id, "external_messager", subject_id)
                )
        if namespace == "Carepath" and relation == "view":
            return self._carepath_view(object_id, subject_id)
        if namespace == "Organisation" and relation == "view":
            return self._org_view(object_id, subject_id)
        return self._has_direct(namespace, object_id, relation, subject_id)

    async def query_tuples(
        self,
        *,
        namespace: KetoNamespace,
        object_id: str | None = None,
        relation: str | None = None,
    ) -> list[RelationTuple]:
        return [
            t
            for t in self.tuples
            if t.namespace == namespace
            and (object_id is None or t.object_id == object_id)
            and (relation is None or t.relation == relation)
        ]

    # ── write API ───────────────────────────────────────────────────────

    async def insert_tuple(self, relation_tuple: RelationTuple) -> None:
        self.tuples.add(relation_tuple)

    async def delete_tuple(self, relation_tuple: RelationTuple) -> None:
        self.tuples.discard(relation_tuple)
