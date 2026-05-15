from __future__ import annotations

from app.schemas._list.page import Page


def test_build_zero_total() -> None:
    p = Page[int].build(items=[], page=1, page_size=25, total=0)
    assert p.items == []
    assert p.total == 0
    assert p.total_pages == 0


def test_build_exact_multiple() -> None:
    p = Page[int].build(items=[1, 2], page=1, page_size=25, total=50)
    assert p.total_pages == 2


def test_build_rounds_up() -> None:
    p = Page[int].build(items=[1], page=3, page_size=25, total=51)
    assert p.total_pages == 3


def test_envelope_shape() -> None:
    p = Page[str].build(items=["a"], page=1, page_size=10, total=1)
    dumped = p.model_dump()
    assert set(dumped.keys()) == {"items", "page", "page_size", "total", "total_pages"}
