from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.enums.care_team import CareTeamStatus, RoleInCare
from app.schemas.care_team import (
    CareTeamCreate,
    CareTeamUpdate,
    ParticipantCreate,
    ParticipantRoleChange,
)


class TestParticipantCreate:
    def test_role_enum_round_trip(self) -> None:
        payload = ParticipantCreate(user_id=uuid4(), role_in_care=RoleInCare.PRIMARY)
        assert payload.role_in_care == RoleInCare.PRIMARY
        assert payload.model_dump(mode="json")["role_in_care"] == "primary"

    def test_unknown_field_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ParticipantCreate.model_validate(
                {"user_id": str(uuid4()), "role_in_care": "primary", "foo": "bar"}
            )


class TestParticipantRoleChange:
    def test_accepts_role_only(self) -> None:
        change = ParticipantRoleChange(role_in_care=RoleInCare.CONSULTING)
        assert change.role_in_care == RoleInCare.CONSULTING

    def test_rejects_extras(self) -> None:
        with pytest.raises(ValidationError):
            ParticipantRoleChange.model_validate(
                {"role_in_care": "primary", "user_id": str(uuid4())}
            )


class TestCareTeamCreate:
    def test_inline_participants(self) -> None:
        payload = CareTeamCreate(
            name="ZAS Care",
            participants=[ParticipantCreate(user_id=uuid4(), role_in_care=RoleInCare.PRIMARY)],
        )
        assert payload.name == "ZAS Care"
        assert len(payload.participants) == 1

    def test_empty_payload_is_valid(self) -> None:
        # All fields optional — a bare team payload is fine.
        payload = CareTeamCreate()
        assert payload.participants == []


class TestCareTeamUpdate:
    def test_status_enum_round_trip(self) -> None:
        payload = CareTeamUpdate(status=CareTeamStatus.INACTIVE)
        assert payload.model_dump(mode="json")["status"] == "inactive"

    def test_unknown_field_rejected(self) -> None:
        with pytest.raises(ValidationError):
            CareTeamUpdate.model_validate({"name": "x", "patient_id": str(uuid4())})
