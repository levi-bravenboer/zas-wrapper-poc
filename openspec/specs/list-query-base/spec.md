# list-query-base Specification

## Purpose
TBD - created by archiving change add-datatable-base. Update Purpose after archive.
## Requirements
### Requirement: Shared `ListQuery` request shape for list endpoints

The backend SHALL define a single `ListQuery` Pydantic model in `app/schemas/_list/list_query.py` that carries the canonical query-string shape for every list endpoint: `page` (int, default `1`, `>= 1`), `page_size` (int, default `25`, `>= 1`, `<= 100`), `q` (str, optional, trimmed), `order_by` (str, optional), `order` (`Literal["asc", "desc"]`, default `"asc"`), and `filters` (`dict[str, dict[Operator, list[str]]]` where `Operator` is one of `"eq"`, `"in"`, `"gte"`, `"lte"`, `"contains"`, `"not"`, default empty). A FastAPI dependency `ListQueryParamsDep` SHALL parse the query string into a `ListQuery` and SHALL be the only way routes obtain list params.

#### Scenario: Defaults applied when query string is empty

- **WHEN** a list route is called with no query params
- **THEN** the resolved `ListQuery` MUST equal `ListQuery(page=1, page_size=25, q=None, order_by=None, order="asc", filters={})`

#### Scenario: `page_size` upper bound enforced

- **WHEN** a request supplies `?page_size=500`
- **THEN** FastAPI MUST reject the request with HTTP 422 and the response body MUST mention `page_size`

#### Scenario: Whitespace-only `q` is normalised to `None`

- **WHEN** a request supplies `?q=%20%20%20`
- **THEN** the resolved `ListQuery.q` MUST be `None`

#### Scenario: `order` rejected when not `asc` / `desc`

- **WHEN** a request supplies `?order=descending`
- **THEN** FastAPI MUST reject the request with HTTP 422

#### Scenario: Single value `filter[<k>]=v` parses as `eq`

- **WHEN** a request supplies `?filter[role]=caregiver`
- **THEN** `ListQuery.filters` MUST equal `{"role": {"eq": ["caregiver"]}}`

#### Scenario: Repeated `filter[<k>]=v` parses as `in`

- **WHEN** a request supplies `?filter[status]=active&filter[status]=pending`
- **THEN** `ListQuery.filters` MUST equal `{"status": {"in": ["active", "pending"]}}`

#### Scenario: Operator-suffixed filter parses with operator key

- **WHEN** a request supplies `?filter[created_at][gte]=2026-01-01&filter[created_at][lte]=2026-12-31`
- **THEN** `ListQuery.filters` MUST equal `{"created_at": {"gte": ["2026-01-01"], "lte": ["2026-12-31"]}}`

#### Scenario: Unknown operator rejected

- **WHEN** a request supplies `?filter[name][regex]=^a`
- **THEN** FastAPI MUST reject the request with HTTP 422 referencing `regex`

#### Scenario: `contains` operator parses with values list

- **WHEN** a request supplies `?filter[name][contains]=anna`
- **THEN** `ListQuery.filters` MUST equal `{"name": {"contains": ["anna"]}}`

#### Scenario: `not` operator parses with values list

- **WHEN** a request supplies `?filter[status][not]=archived&filter[status][not]=deleted`
- **THEN** `ListQuery.filters` MUST equal `{"status": {"not": ["archived", "deleted"]}}`

### Requirement: Generic `Page[T]` response envelope

The backend SHALL define a generic Pydantic model `Page[T]` in `app/schemas/_list/page.py` with fields `items: list[T]`, `page: int`, `page_size: int`, `total: int`, `total_pages: int`. Every list endpoint SHALL return `Page[<DomainSchema>]` so OpenAPI schema names are stable and `openapi-typescript` produces typed clients.

#### Scenario: Envelope fields present and typed

- **WHEN** a domain list endpoint returns `Page[Patient]`
- **THEN** `openapi.json` MUST contain a `Page_Patient_` schema with `items` (array), `page`, `page_size`, `total`, `total_pages` (all integers) as required fields

#### Scenario: `total_pages` computed from `total` and `page_size`

- **WHEN** `total = 47` and `page_size = 25`
- **THEN** `total_pages` MUST equal `2`

#### Scenario: Empty page returns `total = 0` and `total_pages = 0`

- **WHEN** a list query matches no rows
- **THEN** the response MUST be `{items: [], page: <requested>, page_size: <requested>, total: 0, total_pages: 0}`

### Requirement: `BaseListRepository[T]` composes the query

The backend SHALL define `BaseListRepository[T]` in `app/repositories/base.py` extending `BaseRepository[T]`. Subclasses SHALL declare class attributes:

- `orderable_fields: frozenset[str]` (default `frozenset()`)
- `filterable_fields: dict[str, frozenset[Operator]]` (default `{}`) — maps field name → set of allowed operators (`eq`, `in`, `gte`, `lte`, `contains`, `not`)
- `searchable_fields: tuple[InstrumentedAttribute[str], ...]` (default `()`)

A method `list_page(query: ListQuery) -> Page[T]` SHALL build the final SQLAlchemy `Select`, run the page query and the total count in a single round-trip using `count(*) OVER ()`, and return a `Page[T]` filled with ORM rows. Repository subclasses MUST NOT override the root `Select` — they extend by overriding `_extra_filters(query) -> Sequence[ColumnElement]` for domain-specific clauses.

#### Scenario: Soft-deleted rows excluded by default

- **WHEN** `list_page(query)` runs against a table containing rows with `deleted_at IS NOT NULL`
- **THEN** the returned `items` MUST exclude soft-deleted rows and `total` MUST count only live rows

#### Scenario: Tenant scoping automatic for `TenantOwnedEntity` subclasses

- **WHEN** `list_page(query)` runs for a model that inherits `TenantOwnedEntity` and `session.info[SESSION_ACTOR_KEY]` points to a caregiver in tenant `T1`
- **THEN** the result set MUST contain only rows with `tenant_id = T1`, regardless of subclass `_extra_filters` overrides

#### Scenario: `order_by` outside `orderable_fields` rejected

- **WHEN** a request resolves to `ListQuery(order_by="password_hash", ...)` and `password_hash` is not in the subclass's `orderable_fields`
- **THEN** the dependency MUST reject the request with HTTP 422 before any SQL is issued

#### Scenario: Filter field outside `filterable_fields` rejected

- **WHEN** a request resolves to `filters = {"created_at": {"gte": [...]}}` and `created_at` is not a key in the subclass's `filterable_fields`
- **THEN** the dependency MUST reject the request with HTTP 422 before any SQL is issued

#### Scenario: Filter operator not allowed for field rejected

- **WHEN** a request resolves to `filters = {"status": {"contains": ["act"]}}` and `filterable_fields["status"] = {"eq", "in"}`
- **THEN** the dependency MUST reject the request with HTTP 422 referencing `status` and `contains`

#### Scenario: `eq` and `in` translate to SQLAlchemy correctly

- **WHEN** `list_page(ListQuery(filters={"role": {"in": ["caregiver", "admin"]}}))` runs
- **THEN** the generated SQL MUST contain `role IN ('caregiver', 'admin')`

#### Scenario: `gte` and `lte` translate to SQLAlchemy correctly

- **WHEN** `list_page(ListQuery(filters={"created_at": {"gte": ["2026-01-01"], "lte": ["2026-12-31"]}}))` runs
- **THEN** the generated SQL MUST contain `created_at >= '2026-01-01'` AND `created_at <= '2026-12-31'`

#### Scenario: `contains` translates to case-insensitive ILIKE

- **WHEN** `list_page(ListQuery(filters={"name": {"contains": ["anna"]}}))` runs
- **THEN** the generated SQL MUST contain `lower(name) LIKE '%anna%'`

#### Scenario: `not` translates to negated `IN`

- **WHEN** `list_page(ListQuery(filters={"status": {"not": ["archived", "deleted"]}}))` runs
- **THEN** the generated SQL MUST contain `status NOT IN ('archived', 'deleted')`

#### Scenario: `q` ORs `ILIKE` across `searchable_fields`

- **WHEN** a request supplies `?q=anna` against a repository with `searchable_fields = (User.email, User.display_name)`
- **THEN** the generated SQL MUST include `WHERE (lower(email) LIKE '%anna%' OR lower(display_name) LIKE '%anna%')` and matches MUST be case-insensitive

#### Scenario: `total` and `items` come from one round-trip

- **WHEN** `list_page(query)` runs and SQL logging captures issued statements
- **THEN** exactly one `SELECT` MUST be issued for the page+count combined (window function), not two

#### Scenario: Single-column ordering only

- **WHEN** a request supplies multiple `order_by` values
- **THEN** FastAPI MUST reject the request with HTTP 422

### Requirement: Per-repository default sort

`BaseListRepository[T]` SHALL declare a class attribute `default_order: tuple[str, Literal["asc", "desc"]] | None = None`. When `ListQuery.order_by is None`, `list_page` SHALL apply the `default_order`. The default's field name MUST be in `orderable_fields` — a startup assertion SHALL enforce this. Repositories MAY declare `default_order = None` to require explicit `order_by` from callers.

#### Scenario: Default sort applied when caller omits `order_by`

- **GIVEN** a repository declares `default_order = ("created_at", "desc")` and `orderable_fields` contains `"created_at"`
- **WHEN** `list_page(ListQuery(order_by=None, ...))` runs
- **THEN** the generated SQL MUST contain `ORDER BY created_at DESC NULLS LAST`

#### Scenario: Explicit `order_by` overrides default

- **GIVEN** a repository declares `default_order = ("created_at", "desc")`
- **WHEN** `list_page(ListQuery(order_by="name", order="asc", ...))` runs
- **THEN** the generated SQL MUST contain `ORDER BY name ASC NULLS LAST` and MUST NOT reference `created_at` in the ORDER BY clause

#### Scenario: `default_order` field must be orderable

- **WHEN** a repository declares `default_order = ("password_hash", "asc")` and `password_hash` is not in `orderable_fields`
- **THEN** importing the repository module MUST raise an assertion error

#### Scenario: `default_order = None` requires explicit `order_by`

- **GIVEN** a repository declares `default_order = None`
- **WHEN** `list_page(ListQuery(order_by=None, ...))` runs
- **THEN** result ordering MUST be unspecified (no `ORDER BY` clause emitted) — caller is responsible for sending `order_by`

### Requirement: List route URL convention

The backend SHALL expose every list endpoint at `GET /<resource>` where `<resource>` is the plural, kebab-case resource name (e.g. `/patients`, `/tasks`, `/users`). Detail endpoints SHALL use `GET /<resource>/{id}`. The `/list` suffix is forbidden. A conformance test SHALL walk every route whose `response_model` is a `Page[*]` subclass and assert the path matches `^/[a-z]+(-[a-z]+)*$` (no `{id}`, no `/list`).

#### Scenario: Conformance test fails when a list route uses `/list` suffix

- **GIVEN** a route is declared as `GET /patients/list` returning `Page[Patient]`
- **WHEN** the conformance test runs
- **THEN** the test MUST fail and the failure MUST cite the offending path

#### Scenario: Detail endpoint not flagged

- **GIVEN** a route is declared as `GET /patients/{patient_id}` returning `Patient`
- **WHEN** the conformance test runs
- **THEN** the test MUST NOT flag it (response_model is not a `Page[*]`)

### Requirement: Shared `BulkResult` schema for bulk actions

The backend SHALL define `BulkResult` in `app/schemas/_bulk/bulk_result.py`: `{succeeded: list[UUID], failed: list[BulkFailure]}` where `BulkFailure = {id: UUID, code: str, message: str}`. Bulk endpoints SHALL accept a request body containing `ids: list[UUID]` (with optional additional action params) and SHALL return `BulkResult`. Bulk endpoints SHALL be exposed at `POST /<resource>/<action>` where action is a verb (`archive`, `assign`, `complete`, `delete`, `unassign`, ...). A conformance test SHALL enforce this shape across all bulk endpoints in the app.

#### Scenario: Bulk archive succeeds for some ids, fails for others

- **GIVEN** a bulk archive endpoint receives 5 ids, where 3 succeed and 2 fail (one not found, one already archived)
- **WHEN** the endpoint returns
- **THEN** the response MUST be HTTP 200 with body `{succeeded: [<3-uuids>], failed: [{id: <id>, code: "not_found", message: ...}, {id: <id>, code: "already_archived", message: ...}]}`

#### Scenario: All ids fail

- **GIVEN** every id in a bulk request fails
- **WHEN** the endpoint returns
- **THEN** the response MUST still be HTTP 200 with `succeeded: []` and the full `failed` list — NOT HTTP 4xx (the request itself was well-formed)

#### Scenario: Conformance test enforces bulk shape

- **GIVEN** a `POST /patients/archive` route exists
- **WHEN** the conformance test runs
- **THEN** the test MUST assert the request body model has an `ids: list[UUID]` field and the response model is a subclass of `BulkResult`

### Requirement: Default page size and bounds are configurable per route

The backend SHALL allow a route to override `default_page_size` and `max_page_size` for its `ListQueryParamsDep` instance via a factory. Global defaults SHALL be `default_page_size = 25`, `max_page_size = 100`. Overrides MUST be reflected in the OpenAPI parameter documentation.

#### Scenario: Route-level override surfaces in OpenAPI

- **WHEN** a route declares `ListQueryParamsDep(default_page_size=10, max_page_size=50)`
- **THEN** the OpenAPI parameter documentation for `page_size` on that operation MUST report default `10` and maximum `50`

### Requirement: Soft-delete inclusion not exposed in PoC

For PoC scope, the backend SHALL NOT expose a query-string toggle to include soft-deleted rows in list responses. `list_page` SHALL always filter `deleted_at IS NULL`. A future change MAY expose a per-route `include_deleted` flag once admin UX requires it.

#### Scenario: No `include_deleted` parameter accepted

- **WHEN** a request supplies `?include_deleted=1` to any list endpoint
- **THEN** the parameter MUST be ignored and the response MUST still exclude soft-deleted rows
