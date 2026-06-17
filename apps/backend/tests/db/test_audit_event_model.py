from __future__ import annotations

from app.db.base import Base
from app.db.models import AuditEvent


def test_audit_events_table_registered() -> None:
    assert "audit_events" in Base.metadata.tables
    table = Base.metadata.tables["audit_events"]
    expected = {
        "id",
        "created_at",
        "actor_type",
        "actor_id",
        "actor_label",
        "tenant_id",
        "action",
        "result",
        "event_code",
        "resource_type",
        "resource_id",
        "request_id",
        "patient_id",
        "purpose_of_use",
        "changes",
        "context",
    }
    assert set(table.columns.keys()) == expected


def test_audit_events_is_append_only() -> None:
    table = Base.metadata.tables["audit_events"]
    # Immutable: no soft-delete / mutation columns.
    assert "updated_at" not in table.columns
    assert "deleted_at" not in table.columns


def test_audit_events_has_no_actor_or_tenant_fk() -> None:
    table = Base.metadata.tables["audit_events"]
    assert table.columns["actor_id"].foreign_keys == set()
    assert table.columns["tenant_id"].foreign_keys == set()


def test_patient_id_has_no_fk_and_is_nullable() -> None:
    table = Base.metadata.tables["audit_events"]
    # Must outlive patient deletion / archival — no FK, like actor_id/tenant_id.
    assert table.columns["patient_id"].foreign_keys == set()
    assert table.columns["patient_id"].nullable is True


def test_new_fhir_columns_nullable() -> None:
    table = Base.metadata.tables["audit_events"]
    assert table.columns["event_code"].nullable is True
    assert table.columns["purpose_of_use"].nullable is True


def test_audit_events_indexes_present() -> None:
    table = Base.metadata.tables["audit_events"]
    names = {ix.name for ix in table.indexes}
    assert {
        "ix_audit_events_resource",
        "ix_audit_events_actor",
        "ix_audit_events_tenant",
        "ix_audit_events_action_result",
        "ix_audit_events_request",
        "ix_audit_events_patient",
        "ix_audit_events_event_code",
    } <= names


def test_audit_event_importable() -> None:
    assert AuditEvent.__tablename__ == "audit_events"
