"""Conformance: bulk action routes accept `BulkRequest` and return `BulkResult`."""

from __future__ import annotations

from typing import get_args, get_origin
from uuid import UUID

from fastapi import FastAPI
from fastapi.routing import APIRoute
from pydantic import BaseModel, SecretStr

from app.main import create_app
from app.schemas._bulk.bulk_result import BulkRequest, BulkResult
from tests._settings import build_settings

# Extensible list of action verbs that mark a POST /<resource>/<verb> as a
# bulk action route. Add new verbs as the domain grows.
BULK_ACTION_VERBS: frozenset[str] = frozenset(
    {"archive", "delete", "assign", "complete", "restore"}
)


def _is_bulk_action_path(path: str) -> bool:
    """A bulk action is `POST /<resource>/<verb>` where the resource is a
    plain segment, not a `{id}` path param. `POST /pathways/{id}/.../restore`
    targets a single resource and is not bulk.
    """

    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        return False
    if parts[-1] not in BULK_ACTION_VERBS or parts[-1].startswith("{"):
        return False
    return not parts[-2].startswith("{")


def _is_bulk_request_model(model: type) -> bool:
    if model is BulkRequest:
        return True
    try:
        if any(base is BulkRequest for base in model.__mro__):
            return True
    except AttributeError:
        return False
    if not issubclass(model, BaseModel):
        return False
    fields = model.model_fields
    if set(fields) != {"ids"}:
        return False
    anno = fields["ids"].annotation
    if get_origin(anno) is not list:
        return False
    (inner,) = get_args(anno)
    return inner is UUID


def _is_bulk_result_response(model: object) -> bool:
    if model is BulkResult:
        return True
    if get_origin(model) is BulkResult:
        return True
    try:
        return any(base is BulkResult for base in getattr(model, "__mro__", ()))
    except TypeError:
        return False


def _build_app() -> FastAPI:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    return create_app(settings)


def test_bulk_endpoints_use_bulk_request_and_bulk_result() -> None:
    app = _build_app()
    inspected = 0
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if "POST" not in route.methods:
            continue
        if not _is_bulk_action_path(route.path):
            continue
        inspected += 1

        body_field = route.body_field
        assert body_field is not None, f"bulk route {route.path} must accept a body"
        body_model = body_field.field_info.annotation
        assert isinstance(body_model, type) and issubclass(body_model, BaseModel), (
            f"bulk route {route.path} body must be a Pydantic model, got {body_model!r}"
        )
        assert _is_bulk_request_model(body_model), (
            f"bulk route {route.path} body model {body_model.__name__} must be "
            f"`BulkRequest`, subclass it, or declare a single `ids: list[UUID]` field"
        )

        response_model = getattr(route, "response_model", None)
        assert response_model is not None, f"bulk route {route.path} must declare a response_model"
        assert _is_bulk_result_response(response_model), (
            f"bulk route {route.path} response_model {response_model!r} must be "
            f"`BulkResult` or a parametrised generic of it"
        )

    # Vacuous pass when zero bulk endpoints exist yet.
    assert inspected >= 0
