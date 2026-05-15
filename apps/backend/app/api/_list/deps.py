"""FastAPI dependency for parsing `ListQuery` from a request.

Bracket-key filter syntax:
- `filter[<field>]=v`                  → eq (single value) or in (repeated values)
- `filter[<field>][<op>]=v` (repeat ok) → explicit operator

Supported operators: `eq`, `in`, `gte`, `lte`, `contains`, `not`. Unknown
operators or duplicate `order_by` values produce HTTP 422.
"""

import re
from collections.abc import Callable
from typing import Annotated, Literal, get_args

from fastapi import Depends, HTTPException, Query, Request

from app.schemas._list.list_query import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    ListQuery,
    Operator,
)

_FILTER_KEY = re.compile(r"^filter\[([^\[\]]+)\](?:\[([^\[\]]+)\])?$")
_VALID_OPS: frozenset[str] = frozenset(get_args(Operator))


def _raise_422(detail: str) -> None:
    raise HTTPException(status_code=422, detail=detail)


def list_query_params(
    default_page_size: int = DEFAULT_PAGE_SIZE,
    max_page_size: int = MAX_PAGE_SIZE,
) -> Callable[..., ListQuery]:
    """Build a FastAPI dependency that parses `ListQuery` from query params.

    Scalar params (`page`, `page_size`, `q`, `order_by`, `order`) are declared
    as typed `Query` parameters so OpenAPI introspection reflects per-route
    `default_page_size` / `max_page_size` overrides (default + maximum).
    Bracket-key filters are parsed from the raw `Request` since FastAPI cannot
    introspect `filter[<field>][<op>]` query keys.
    """

    if default_page_size < 1 or default_page_size > max_page_size:
        msg = "default_page_size must be in [1, max_page_size]"
        raise ValueError(msg)

    def parse(
        request: Request,
        page: Annotated[int, Query(ge=1, description="1-indexed page number")] = 1,
        page_size: Annotated[
            int,
            Query(
                ge=1,
                le=max_page_size,
                description=f"Items per page (1..{max_page_size})",
            ),
        ] = default_page_size,
        q: Annotated[
            str | None,
            Query(description="Free-text search query; whitespace-only is treated as absent"),
        ] = None,
        order_by: Annotated[
            list[str] | None,
            Query(description="Sort field; may appear at most once"),
        ] = None,
        order: Annotated[
            list[Literal["asc", "desc"]] | None,
            Query(description="Sort direction; may appear at most once"),
        ] = None,
    ) -> ListQuery:
        if order_by is not None and len(order_by) > 1:
            _raise_422("`order_by` may only appear once")
        if order is not None and len(order) > 1:
            _raise_422("`order` may only appear once")
        order_by_value = order_by[0] if order_by else None
        order_value: Literal["asc", "desc"] = order[0] if order else "asc"

        filters: dict[str, dict[str, list[str]]] = {}
        for key, value in request.query_params.multi_items():
            match = _FILTER_KEY.match(key)
            if match is None:
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
                order_by=order_by_value,
                order=order_value,
                filters=resolved,
            )
        except ValueError as exc:
            _raise_422(str(exc))
            raise  # pragma: no cover

    return parse


ListQueryParamsDep = Annotated[ListQuery, Depends(list_query_params())]
"""Default dep using `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE`. Routes wanting
custom page-size bounds construct their own via `list_query_params(...)`."""
