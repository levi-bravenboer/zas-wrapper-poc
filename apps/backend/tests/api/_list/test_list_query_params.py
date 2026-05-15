from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api._list import ListQueryParamsDep, list_query_params
from app.schemas._list.list_query import ListQuery


def _make_client(*, default_page_size: int = 25, max_page_size: int = 100) -> TestClient:
    app = FastAPI()

    @app.get("/_dummy")
    def _dummy(query: ListQueryParamsDep) -> dict[str, object]:
        return query.model_dump()

    custom_parser = list_query_params(
        default_page_size=default_page_size,
        max_page_size=max_page_size,
    )

    @app.get("/_dummy_custom")
    def _dummy_custom(
        query: Annotated[ListQuery, Depends(custom_parser)],
    ) -> dict[str, object]:
        return query.model_dump()

    return TestClient(app)


def test_defaults_when_no_params() -> None:
    client = _make_client()
    payload = client.get("/_dummy").json()
    assert payload["page"] == 1
    assert payload["page_size"] == 25
    assert payload["q"] is None
    assert payload["order_by"] is None
    assert payload["order"] == "asc"
    assert payload["filters"] == {}


def test_scalar_params_parsed() -> None:
    client = _make_client()
    payload = client.get(
        "/_dummy?page=3&page_size=10&q=alice&order_by=name&order=desc"
    ).json()
    assert payload == {
        "page": 3,
        "page_size": 10,
        "q": "alice",
        "order_by": "name",
        "order": "desc",
        "filters": {},
    }


def test_implicit_eq_single_value() -> None:
    client = _make_client()
    payload = client.get("/_dummy?filter[status]=open").json()
    assert payload["filters"] == {"status": {"eq": ["open"]}}


def test_implicit_in_multi_value() -> None:
    client = _make_client()
    payload = client.get("/_dummy?filter[status]=open&filter[status]=closed").json()
    assert payload["filters"] == {"status": {"in": ["open", "closed"]}}


def test_explicit_operators() -> None:
    client = _make_client()
    payload = client.get(
        "/_dummy"
        "?filter[age][gte]=18"
        "&filter[age][lte]=65"
        "&filter[name][contains]=ali"
        "&filter[role][not]=admin"
    ).json()
    assert payload["filters"] == {
        "age": {"gte": ["18"], "lte": ["65"]},
        "name": {"contains": ["ali"]},
        "role": {"not": ["admin"]},
    }


def test_unknown_operator_rejected() -> None:
    client = _make_client()
    response = client.get("/_dummy?filter[name][weird]=1")
    assert response.status_code == 422
    assert "unknown filter operator" in response.json()["detail"]


def test_duplicate_order_by_rejected() -> None:
    client = _make_client()
    response = client.get("/_dummy?order_by=name&order_by=email")
    assert response.status_code == 422


def test_invalid_page_rejected() -> None:
    client = _make_client()
    response = client.get("/_dummy?page=0")
    assert response.status_code == 422


def test_page_size_clamped_to_max() -> None:
    client = _make_client(max_page_size=50)
    payload = client.get("/_dummy_custom?page_size=500").json()
    assert payload["page_size"] == 50


def test_route_default_page_size_override() -> None:
    client = _make_client(default_page_size=5, max_page_size=50)
    payload = client.get("/_dummy_custom").json()
    assert payload["page_size"] == 5


def test_whitespace_q_normalised_to_none() -> None:
    client = _make_client()
    payload = client.get("/_dummy?q=%20%20").json()
    assert payload["q"] is None
