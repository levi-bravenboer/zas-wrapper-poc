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
        "resource_type",
        "resource_id",
        "request_id",
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


def test_audit_events_indexes_present() -> None:
    table = Base.metadata.tables["audit_events"]
    names = {ix.name for ix in table.indexes}
    assert {
        "ix_audit_events_resource",
        "ix_audit_events_actor",
        "ix_audit_events_tenant",
        "ix_audit_events_action_result",
        "ix_audit_events_request",
    } <= names


def test_audit_event_importable() -> None:
    assert AuditEvent.__tablename__ == "audit_events"
