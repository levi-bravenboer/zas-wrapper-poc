from __future__ import annotations

from app.db.base import Base
from app.db.models import Appointment, AppointmentParticipant


def test_appointment_table_registered() -> None:
    assert "appointments" in Base.metadata.tables
    table = Base.metadata.tables["appointments"]
    expected_columns = {
        "id",
        "tenant_id",
        "patient_id",
        "pathway_block_instance_id",
        "title",
        "description",
        "kind",
        "starts_at",
        "ends_at",
        "modality",
        "location_text",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by",
        "updated_by",
        "deleted_by",
    }
    assert expected_columns.issubset(set(table.columns.keys()))


def test_appointment_participants_table_registered() -> None:
    assert "appointment_participants" in Base.metadata.tables
    table = Base.metadata.tables["appointment_participants"]
    expected_columns = {
        "id",
        "tenant_id",
        "appointment_id",
        "user_id",
        "role",
        "created_at",
        "updated_at",
        "deleted_at",
    }
    assert expected_columns.issubset(set(table.columns.keys()))


def test_appointment_orm_models_importable() -> None:
    assert Appointment.__tablename__ == "appointments"
    assert AppointmentParticipant.__tablename__ == "appointment_participants"


def test_appointment_pathway_block_instance_id_has_no_fk() -> None:
    column = Base.metadata.tables["appointments"].columns["pathway_block_instance_id"]
    assert column.nullable is True
    assert column.foreign_keys == set()
