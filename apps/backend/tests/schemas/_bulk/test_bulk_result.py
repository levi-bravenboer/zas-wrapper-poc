from __future__ import annotations

from uuid import UUID, uuid4

from app.schemas._bulk import BulkFailure, BulkRequest, BulkResult


def test_bulk_result_mixed_payload() -> None:
    ok = uuid4()
    bad = uuid4()
    result = BulkResult[UUID](
        succeeded=[ok],
        failed=[BulkFailure(id=bad, code="conflict", message="already archived")],
    )
    assert result.succeeded == [ok]
    assert result.failed[0].id == bad
    assert result.failed[0].code == "conflict"


def test_bulk_result_empty_is_valid() -> None:
    result = BulkResult[UUID](succeeded=[], failed=[])
    assert result.succeeded == []
    assert result.failed == []


def test_bulk_failure_round_trip() -> None:
    f = BulkFailure(id=uuid4(), code="", message="")
    dumped = f.model_dump()
    restored = BulkFailure.model_validate(dumped)
    assert restored == f


def test_bulk_request_round_trip() -> None:
    req = BulkRequest[UUID](ids=[uuid4(), uuid4()])
    dumped = req.model_dump()
    restored = BulkRequest[UUID].model_validate(dumped)
    assert restored.ids == req.ids


def test_bulk_result_openapi_schema_naming() -> None:
    schema = BulkResult[UUID].model_json_schema()
    assert "BulkResult" in schema["title"]
    assert "BulkFailure" in schema["$defs"]
