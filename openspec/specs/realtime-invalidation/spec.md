# realtime-invalidation Specification

## Purpose
TBD - created by archiving change add-datatable-base. Update Purpose after archive.
## Requirements
### Requirement: SSE endpoint streams tenant-scoped invalidation events

The backend SHALL expose `GET /events` returning a `text/event-stream` response. Authentication SHALL reuse the existing session cookie (same `SessionDep` as REST routes); unauthenticated requests MUST receive HTTP 401. The endpoint SHALL subscribe the connection to events scoped to the caller's tenant (`session.info[SESSION_ACTOR_KEY].tenant_id`) for the connection lifetime. Each event SHALL be encoded as `data: {json}\n\n` where the JSON body conforms to `RealtimeEvent` (`{resource: str, action: "upsert" | "delete", id: str | null, v: int}`, with `v=1` for the PoC schema version). A `: keep-alive` comment SHALL be sent every 15 seconds to defeat proxy buffering. The response headers SHALL include `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and `Connection: keep-alive`.

#### Scenario: Unauthenticated connection rejected

- **WHEN** a client connects to `GET /events` without a valid session cookie
- **THEN** the server MUST respond with HTTP 401 and not open the stream

#### Scenario: Authenticated connection receives tenant-scoped events

- **GIVEN** a caregiver in tenant `T1` is connected to `/events`
- **AND** another caregiver in tenant `T2` creates a `task` in tenant `T2`
- **WHEN** the broadcaster publishes the resulting event
- **THEN** the `T1` connection MUST NOT receive any event referencing the `T2` task

#### Scenario: Event schema matches `RealtimeEvent`

- **WHEN** a task is upserted in the caller's tenant
- **THEN** the next SSE message body MUST be valid JSON conforming to `{resource: "tasks", action: "upsert", id: "<uuid>", v: 1}`

#### Scenario: Keep-alive sent every 15 seconds

- **WHEN** a client stays connected for 60 seconds with no event activity
- **THEN** the server MUST have sent at least 3 `: keep-alive` SSE comment lines during that window

#### Scenario: Anti-buffering headers present

- **WHEN** a client opens the SSE response
- **THEN** the response headers MUST include `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and `Content-Type: text/event-stream`

### Requirement: In-process pub/sub fan-out

The backend SHALL implement `app/realtime/pubsub.py` exposing `publish(tenant_id: UUID, event: RealtimeEvent) -> None` and `subscribe(tenant_id: UUID) -> AsyncIterator[RealtimeEvent]`. The implementation SHALL maintain a `defaultdict[UUID, set[asyncio.Queue]]` mapping tenants to subscriber queues. `subscribe` SHALL create a fresh queue, yield events from it until the consumer cancels, and remove the queue on exit. `publish` SHALL iterate the tenant's subscribers and call `put_nowait`; if a subscriber queue is full (configurable cap, default 256), the event SHALL be dropped for that subscriber and a `realtime_dropped_events_total` counter MUST be incremented. The module SHALL emit metrics `realtime_active_subscribers` (gauge) and `realtime_published_events_total` (counter) for observability.

#### Scenario: Publish reaches all current subscribers

- **GIVEN** two `subscribe(T1)` consumers active
- **WHEN** `publish(T1, event)` is called
- **THEN** both consumers MUST receive the event

#### Scenario: Publish to one tenant does not reach another

- **GIVEN** a `subscribe(T1)` consumer and a `subscribe(T2)` consumer active
- **WHEN** `publish(T1, event)` is called
- **THEN** the `T2` consumer MUST NOT receive the event

#### Scenario: Full queue drops events for that subscriber only

- **GIVEN** a slow subscriber whose queue is at its cap
- **WHEN** `publish(T1, event)` is called
- **THEN** the slow subscriber MUST NOT receive the event, the `realtime_dropped_events_total` counter MUST increment by 1, and other healthy subscribers MUST receive the event

#### Scenario: Subscriber cleanup on disconnect

- **WHEN** a subscriber's `AsyncIterator` is cancelled or the underlying connection closes
- **THEN** the subscriber's queue MUST be removed from the tenant's set and `realtime_active_subscribers` MUST decrement by 1

### Requirement: Flush hook publishes after-commit

The backend SHALL hook into the SQLAlchemy AsyncSession lifecycle to collect pending invalidation events during `before_flush` (from `session.new | session.dirty | session.deleted`) and publish them via `pubsub.publish` only after the transaction commits successfully. Each affected model SHALL contribute one event per `(resource, action, id)` tuple. The resource name SHALL come from a class attribute `__realtime_resource__: str | None` on the model; if `None`, the model SHALL NOT generate events.

#### Scenario: Commit emits one event per affected row

- **WHEN** a request flushes 3 new `Task` rows and the transaction commits
- **THEN** `pubsub.publish` MUST be invoked exactly 3 times with `{resource: "tasks", action: "upsert", id: <row-id>}` per row

#### Scenario: Rollback does not emit events

- **WHEN** a request flushes a `Task` insert and the transaction rolls back
- **THEN** `pubsub.publish` MUST NOT be invoked for that row

#### Scenario: Soft-delete emits an `upsert` event, not `delete`

- **WHEN** a request sets `deleted_at` on a `Task` row and commits
- **THEN** the published event MUST be `{resource: "tasks", action: "upsert", id: <row-id>, v: 1}` because the row still exists for clients that surface soft-deleted rows

#### Scenario: Hard delete emits `delete` event

- **WHEN** a request hard-deletes a `Task` row and commits
- **THEN** the published event MUST be `{resource: "tasks", action: "delete", id: <row-id>, v: 1}`

#### Scenario: Models without `__realtime_resource__` produce no events

- **WHEN** a request mutates a model that does not declare `__realtime_resource__`
- **THEN** `pubsub.publish` MUST NOT be invoked for that mutation

#### Scenario: Tenant id derived from the row, not the actor

- **WHEN** a `TenantOwnedEntity` row is created with `tenant_id = T1`
- **THEN** the published event MUST be fanned out only to subscribers of tenant `T1`, even if the request's actor belongs to a different tenant (e.g. an admin operating cross-tenant)

### Requirement: Frontend provider invalidates TanStack Query cache

The orchestrator SHALL mount a single `useRealtimeInvalidation()` provider in `src/app/providers.tsx`. The provider SHALL open exactly one `EventSource('/events', { withCredentials: true })` per browser tab while a session is active. On each received message, the provider SHALL parse `RealtimeEvent` and call `queryClient.invalidateQueries({queryKey: [event.resource], exact: false})`. On disconnect, the provider SHALL rely on `EventSource`'s native auto-reconnect; after 5 consecutive failed reconnect attempts within 60 seconds, the provider SHALL fall back to a `refetchOnWindowFocus` warning toast suggesting the user reload.

#### Scenario: Single connection per tab

- **WHEN** the provider mounts in `app/providers.tsx`
- **THEN** exactly one `EventSource` instance MUST be constructed regardless of how many `DataTable`s render

#### Scenario: Resource event invalidates matching query keys

- **GIVEN** a TanStack Query with key `["tasks", "list", {page: 1}]`
- **WHEN** the provider receives `{resource: "tasks", action: "upsert", id: "..."}`
- **THEN** `queryClient.invalidateQueries({queryKey: ["tasks"], exact: false})` MUST be called and the query MUST refetch

#### Scenario: Connection closes on logout

- **WHEN** the user logs out and the session is destroyed
- **THEN** the provider MUST close the `EventSource` and not reopen until a new session is established

#### Scenario: Reconnect after transient disconnect

- **WHEN** the SSE connection drops once and recovers within `EventSource` retry semantics
- **THEN** events emitted while disconnected MAY be missed, but the provider MUST resume invalidating without manual user action — TanStack Query stale-on-focus catches up

#### Scenario: Repeated reconnect failures surface a warning

- **WHEN** 5 reconnect attempts fail within 60 seconds
- **THEN** the provider MUST emit a `toastWarning('data-table.realtime.offline')` and ensure `refetchOnWindowFocus` stays enabled as fallback
