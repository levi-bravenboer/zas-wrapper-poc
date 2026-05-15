from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas._list.list_query import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ListQuery


def test_defaults() -> None:
    q = ListQuery()
    assert q.page == 1
    assert q.page_size == DEFAULT_PAGE_SIZE
    assert q.q is None
    assert q.order_by is None
    assert q.order == "asc"
    assert q.filters == {}


def test_page_must_be_positive() -> None:
    with pytest.raises(ValidationError):
        ListQuery(page=0)


def test_page_size_upper_bound() -> None:
    with pytest.raises(ValidationError):
        ListQuery(page_size=MAX_PAGE_SIZE + 1)


def test_page_size_lower_bound() -> None:
    with pytest.raises(ValidationError):
        ListQuery(page_size=0)


def test_order_literal_enforced() -> None:
    with pytest.raises(ValidationError):
        ListQuery(order="sideways")  # type: ignore[arg-type]


def test_q_whitespace_becomes_none() -> None:
    assert ListQuery(q="   ").q is None
    assert ListQuery(q="").q is None
    assert ListQuery(q="  alice  ").q == "alice"


def test_filters_accept_operator_shape() -> None:
    q = ListQuery(filters={"status": {"in": ["open", "closed"]}})
    assert q.filters["status"]["in"] == ["open", "closed"]
