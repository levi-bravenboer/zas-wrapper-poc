"""Conformance: every `Page`-returning route is GET + plural-noun + ListQuery-driven."""

from __future__ import annotations

import re
from typing import get_origin

from fastapi import FastAPI
from fastapi.routing import APIRoute
from pydantic import SecretStr

from app.api._list.deps import list_query_params
from app.main import create_app
from app.schemas._list.list_query import ListQuery
from app.schemas._list.page import Page
from tests._settings import build_settings

_PLURAL_PATH = re.compile(r"^/[a-z][a-z0-9_-]*s(?:/.*)?$")


def _returns_page(route: APIRoute) -> bool:
    model = getattr(route, "response_model", None)
    if model is None:
        return False
    if model is Page:
        return True
    if get_origin(model) is Page:
        return True
    try:
        return any(base is Page for base in getattr(model, "__mro__", ()))
    except TypeError:
        return False


def _has_list_query_dependency(route: APIRoute) -> bool:
    """True iff one of the route's sub-deps was built by `list_query_params(...)`.

    `list_query_params` returns a closure named `parse`; we recognise the
    factory by attaching a sentinel attribute via wrapping is overkill, so we
    check the callable's qualified name + that the dep's return annotation is
    `ListQuery`.
    """
    for dep in route.dependant.dependencies:
        call = dep.call
        if call is None:
            continue
        return_anno = getattr(call, "__annotations__", {}).get("return")
        if return_anno is ListQuery:
            return True
        # `list_query_params()` returns a closure called `parse` defined in deps.py.
        qualname = getattr(call, "__qualname__", "")
        if qualname.startswith(list_query_params.__qualname__):
            return True
    return False


def _build_app() -> FastAPI:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    return create_app(settings)


def test_list_endpoints_are_get_plural_with_list_query() -> None:
    app = _build_app()
    inspected = 0
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not _returns_page(route):
            continue
        inspected += 1
        assert route.methods == {"GET"}, (
            f"list endpoint {route.path} must be GET-only, got {route.methods}"
        )
        assert not route.path.rstrip("/").endswith("/list"), (
            f"list endpoint {route.path} must not use `/list` suffix"
        )
        assert _PLURAL_PATH.match(route.path), (
            f"list endpoint {route.path} must be a plural-noun path "
            f"(matches {_PLURAL_PATH.pattern})"
        )
        assert _has_list_query_dependency(route), (
            f"list endpoint {route.path} must depend on `list_query_params(...)`"
        )
    # Vacuous pass when zero list endpoints exist yet.
    assert inspected >= 0
