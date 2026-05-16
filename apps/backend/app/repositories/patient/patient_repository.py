from __future__ import annotations

from collections.abc import Sequence
from typing import ClassVar
from uuid import UUID

from sqlalchemy import ColumnElement, select
from sqlalchemy.orm import InstrumentedAttribute

from app.db.models.patient import Patient, PatientIdentifier
from app.repositories.base import BaseListRepository
from app.schemas._list.list_query import ListQuery, Operator


class PatientRepository(BaseListRepository[Patient]):
    model = Patient

    orderable_fields: ClassVar[frozenset[str]] = frozenset(
        {"family_name", "given_name", "birth_date", "created_at", "updated_at"}
    )
    filterable_fields: ClassVar[dict[str, frozenset[Operator]]] = {
        "family_name": frozenset({"eq", "contains"}),
        "given_name": frozenset({"eq", "contains"}),
        "birth_date": frozenset({"eq", "gte", "lte"}),
        "primary_organisation_id": frozenset({"eq", "in"}),
    }
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = (
        Patient.family_name,
        Patient.given_name,
    )
    default_order: ClassVar[tuple[str, str]] = ("family_name", "asc")

    def __init__(
        self,
        session,  # type: ignore[no-untyped-def]
        *,
        identifier: str | None = None,
        visible_patient_ids: frozenset[UUID] | None = None,
    ) -> None:
        super().__init__(session)
        self._identifier = identifier
        self._visible_patient_ids = visible_patient_ids

    def with_identifier(self, identifier: str | None) -> PatientRepository:
        """Return a view of this repo scoped to the given identifier value.

        `identifier` short-circuits the standard `ListQuery` filters: when set,
        the list call joins `patient_identifiers` and returns the at-most-one
        row matching `value == identifier` within the actor's tenant.
        """
        return PatientRepository(
            self._session,
            identifier=identifier,
            visible_patient_ids=self._visible_patient_ids,
        )

    def with_visible_ids(self, ids: frozenset[UUID]) -> PatientRepository:
        """Return a view restricted to `Patient.id IN ids`.

        Used by `PatientService.list_in_tenant` to constrain caregiver
        listings to patients reachable via an open care-team membership.
        Admins bypass this restriction — the service does not call the
        helper for them.
        """
        return PatientRepository(
            self._session,
            identifier=self._identifier,
            visible_patient_ids=ids,
        )

    def _extra_filters(self, query: ListQuery) -> Sequence[ColumnElement[bool]]:
        del query
        extras: list[ColumnElement[bool]] = []
        if self._identifier is not None:
            subq = (
                select(PatientIdentifier.patient_id)
                .where(
                    PatientIdentifier.value == self._identifier,
                    PatientIdentifier.deleted_at.is_(None),
                )
                .scalar_subquery()
            )
            extras.append(Patient.id.in_(subq))
        if self._visible_patient_ids is not None:
            extras.append(Patient.id.in_(self._visible_patient_ids))
        return tuple(extras)

    async def get_by_id(self, tenant_id: UUID, patient_id: UUID) -> Patient | None:
        result = await self._session.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.tenant_id == tenant_id,
                Patient.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def update(self, patient: Patient) -> Patient:
        await self._session.flush()
        return patient
