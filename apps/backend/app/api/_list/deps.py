"""FastAPI dependency for parsing `ListQuery` from a request.

Bracket-key filter syntax:
- `filter[<field>]=v`                  → eq (single value) or in (repeated values)
- `filter[<field>][<op>]=v` (repeat ok) → explicit operator

Supported operators: `eq`, `in`, `gte`, `lte`, `contains`, `not`. Unknown
operators or duplicate `order_by` values produce HTTP 422.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Annotated, get_args

from fastapi import Depends, HTTPException, Request

from app.schemas._list.list_query import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    ListQuery,
    Operator,
)

_FILTER_KEY = re.compile(r"^filter\[([^\[\]]+)\](?:\[([^\[\]]+)\])?$")
_VALID_OPS: frozenset[str] = frozenset(get_args(Operator))
_RESERVED: frozenset[str] = frozenset({"page", "page_size", "q", "order_by", "order"})


def _raise_422(detail: str) -> None:
    raise HTTPException(status_code=422, detail=detail)


def _coerce_int(name: str, value: str) -> int:
    try:
        return int(value)
    except ValueError:
        _raise_422(f"`{name}` must be an integer")
        raise  # pragma: no cover


def list_query_params(
    default_page_size: int = DEFAULT_PAGE_SIZE,
    max_page_size: int = MAX_PAGE_SIZE,
) -> Callable[[Request], ListQuery]:
    """Build a FastAPI dependency that parses `ListQuery` from query params.

    Per-route page-size overrides are applied during parsing; the resulting
    `ListQuery.page_size` is clamped to `[1, max_page_size]`.
    """

    if default_page_size < 1 or default_page_size > max_page_size:
        msg = "default_page_size must be in [1, max_page_size]"
        raise ValueError(msg)

    def parse(request: Request) -> ListQuery:
        page = 1
        page_size = default_page_size
        q: str | None = None
        order_by: str | None = None
        order_seen = False
        order_by_seen = False
        order: str = "asc"
        filters: dict[str, dict[str, list[str]]] = {}

        for key, value in request.query_params.multi_items():
            if key == "page":
                page = _coerce_int("page", value)
                continue
            if key == "page_size":
                page_size = min(_coerce_int("page_size", value), max_page_size)
                continue
            if key == "q":
                q = value
                continue
            if key == "order_by":
                if order_by_seen:
                    _raise_422("`order_by` may only appear once")
                order_by = value
                order_by_seen = True
                continue
            if key == "order":
                if order_seen:
                    _raise_422("`order` may only appear once")
                order = value
                order_seen = True
                continue
            match = _FILTER_KEY.match(key)
            if match is None:
                if key in _RESERVED:
                    continue
                # unknown plain key: let FastAPI ignore (no domain knowledge here)
                continue
            field, op = match.group(1), match.group(2)
            if op is None:
                bucket = filters.setdefault(field, {})
                bucket.setdefault("__implicit__", []).append(value)
            else:
                if op not in _VALID_OPS:
                    _raise_422(f"unknown filter operator `{op}` on field `{field}`")
                bucket = filters.setdefault(field, {})
                bucket.setdefault(op, []).append(value)

        # Resolve implicit (no-op-suffix) values: 1 → eq, 2+ → in.
        resolved: dict[str, dict[Operator, list[str]]] = {}
        for field, ops in filters.items():
            target: dict[Operator, list[str]] = {}
            implicit = ops.pop("__implicit__", None)
            if implicit is not None:
                inferred: Operator = "eq" if len(implicit) == 1 else "in"
                target[inferred] = implicit
            for op_name, values in ops.items():
                target[op_name] = values  # type: ignore[index]
            resolved[field] = target

        try:
            return ListQuery(
                page=page,
                page_size=page_size,
                q=q,
                order_by=order_by,
                order=order,  # type: ignore[arg-type]
                filters=resolved,
            )
        except ValueError as exc:
            _raise_422(str(exc))
            raise  # pragma: no cover

    return parse


ListQueryParamsDep = Annotated[ListQuery, Depends(list_query_params())]
"""Default dep using `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE`. Routes wanting
custom page-size bounds construct their own via `list_query_params(...)`."""
