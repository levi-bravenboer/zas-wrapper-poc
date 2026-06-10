## ADDED Requirements

### Requirement: Inbox aggregator endpoint returns FHIR-Resource-shaped item envelopes

The backend SHALL expose `GET /inbox/items` as a polymorphic aggregator that returns a paginated list of attention items for the authenticated caregiver or admin. Each item SHALL be wrapped in a FHIR-Resource-shaped envelope:

```jsonc
// pseudo-schema, normative
{
  "id": "<uuid>",                          // stable per (resourceType, source-row-id) pair
  "resourceType": "Appointment",            // discriminator; FHIR R4 ResourceType value
  "subject": {                              // FHIR Reference shape
    "reference": "Patient/<patient-uuid>",
    "display": "<family>, <given>",
    "identifier": { "system": "urn:oid:2.16.840.1.113883.2.8.4.1.1", "value": "<insz>" }
  },
  "occurred_at": "<iso datetime>",          // sort dimension; per-resourceType source (Appointment.start, Task.due, etc.)
  "payload": { ... }                        // resourceType-specific slim summary
}
```

`resourceType` SHALL be a value from the FHIR R4 `ResourceType` value set. v1 SHALL emit ONLY `resourceType: "Appointment"`. Future change-windows add `"Task"`, `"Observation"`, etc. by extending the aggregator service — frontend dispatcher already handles unknown kinds gracefully (see `Inbox unknown-resource graceful fallback` below).

`payload` SHALL contain a slim, render-ready summary specific to the `resourceType`. For `resourceType: "Appointment"` the payload SHALL match `AppointmentInboxPayload` (defined below) and SHALL NOT include participants, location, or other heavy fields — those are fetched via `GET /appointments/{id}` if needed.

The route SHALL ride the shared `ListQuery` envelope (`page`, `page_size`, `q`, `order_by`, `order`, bracket-key filters). Response envelope is `Page[InboxItem]` with `items`, `page`, `page_size`, `total`, `total_pages`.

The route SHALL require an authenticated user matching `require_role(Role.ADMIN, Role.CAREGIVER)`. `Role.PATIENT` SHALL be rejected with `403 Forbidden`.

#### Scenario: v1 emits only Appointment items

- **WHEN** `GET /inbox/items` is called and the tenant has appointments + (hypothetical future) tasks
- **THEN** every item in the response MUST have `resourceType === "Appointment"`; no other resourceType MAY appear

#### Scenario: Item id is stable per source row

- **WHEN** the same appointment row is returned across two `GET /inbox/items` calls
- **THEN** the `id` field MUST be identical between the two responses (deterministic derivation, e.g. `"appointment:<appointment.id>"`)

#### Scenario: Subject is FHIR Reference with display + identifier

- **WHEN** an item is returned for a patient with INSZ
- **THEN** `subject.reference` MUST equal `"Patient/<patient.id>"`, `subject.display` MUST equal `"<family>, <given>"`, and `subject.identifier` MUST include the INSZ system + value

#### Scenario: occurred_at sources the sort dimension

- **WHEN** an item's `resourceType === "Appointment"`
- **THEN** the `occurred_at` field MUST equal the underlying `appointments.starts_at` value (ISO datetime, UTC)

#### Scenario: Patient role rejected

- **WHEN** a `patient`-role session calls `GET /inbox/items`
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Cross-tenant items are absent

- **WHEN** a caregiver in tenant A calls `GET /inbox/items` and tenant B has matching-criteria appointments
- **THEN** the response MUST NOT include any item whose source row's `tenant_id` differs from the caller's `tenant_id`

### Requirement: Visibility predicate matches patient access

`GET /inbox/items` SHALL return ONLY items whose `subject` patient passes `require_patient_access(patient_id)` for the calling user. For admins, this is tenant-wide. For caregivers, this is the existing care-team OR PractitionerRole-tree predicate from `patients-base` + `practitioner-role-split`.

The aggregator SHALL NOT introduce a separate visibility surface — the same predicate that gates `GET /patients/{id}` gates inbox items for that patient.

#### Scenario: Caregiver sees inbox items only for accessible patients

- **WHEN** caregiver `C` can access patient `P1` (open care-team row) but not patient `P2`, and both have qualifying future-booked appointments
- **THEN** `GET /inbox/items` for `C` MUST include items for `P1` and MUST NOT include items for `P2`

#### Scenario: Admin sees all inbox items in tenant

- **WHEN** an admin in tenant `T` calls `GET /inbox/items`
- **THEN** the response MUST include every qualifying item whose source row's `tenant_id == T`, regardless of care-team or PractitionerRole

### Requirement: v1 Appointment-item criteria

For `resourceType: "Appointment"`, an `appointments` row qualifies as an inbox item when ALL of the following hold:

- `appointments.status = 'booked'`
- `appointments.starts_at >= now()`
- `appointments.deleted_at IS NULL`
- The source patient passes the caller's `require_patient_access` predicate

The default sort SHALL be `order_by=occurred_at&order=asc` (earliest upcoming first). `order_by` SHALL also accept `created_at` (mapped to the source row's creation timestamp) for the "newly added" sort strategy.

#### Scenario: Booked + future appointment becomes an item

- **WHEN** an appointment row exists with `status='booked'`, `starts_at` 2 days from now, `deleted_at=NULL`, and its patient passes the caller's predicate
- **THEN** the response MUST include a corresponding `resourceType: "Appointment"` item whose `occurred_at` equals that `starts_at`

#### Scenario: Past or non-booked appointment is NOT an item v1

- **WHEN** an appointment row exists with `status='fulfilled'`, OR `status='cancelled'`, OR `starts_at < now()`
- **THEN** the response MUST NOT include any item for that row in v1

#### Scenario: Soft-deleted appointment is NOT an item

- **WHEN** an appointment row exists with `deleted_at IS NOT NULL`
- **THEN** the response MUST NOT include any item for that row

#### Scenario: Default sort orders earliest-first

- **WHEN** `GET /inbox/items` is called without `order_by` or `order`
- **THEN** the response items MUST be ordered by `occurred_at` ascending

#### Scenario: newly_added sort uses source creation timestamp

- **WHEN** `GET /inbox/items?order_by=created_at&order=desc` is called
- **THEN** the items MUST be ordered by the source-row `created_at` descending (most-recently-added first)

### Requirement: AppointmentInboxPayload is a slim render-ready summary

The `payload` field for `resourceType: "Appointment"` SHALL be shaped as:

```jsonc
{
  "title": "<varchar>",
  "kind": "<AppointmentKind>",
  "modality": "<AppointmentModality>",
  "starts_at": "<iso datetime>",
  "ends_at": "<iso datetime>"
}
```

It SHALL NOT include `description`, `location_text`, `participants`, `status`, `pathway_block_instance_id`, or any audit columns. Full appointment data is fetched via `GET /appointments/{id}` on demand.

#### Scenario: Payload omits heavy fields

- **WHEN** any item with `resourceType: "Appointment"` is returned
- **THEN** the `payload` object MUST contain exactly the keys `title`, `kind`, `modality`, `starts_at`, `ends_at` and MUST NOT contain `description`, `location_text`, `participants`, or `status`

### Requirement: Aggregator service module

The backend SHALL provide `app/services/inbox/inbox_service.py::InboxService` exposing `list_items(query: ListQuery, caller: SessionUser) -> Page[InboxItem]`. v1 SHALL implement the service as a single-source adapter over `AppointmentRepository`; the architecture SHALL support additional sources behind a registry pattern (`InboxItemSource[]`) without changing the route handler.

The router SHALL live at `app/api/routers/inbox/inbox_router.py` exposing `GET /inbox/items` with `# AUTH-HARDEN` marker. The route SHALL be tenant-scoped via the session actor's `tenant_id` enforced through the underlying repository (no separate tenant filter at the aggregator layer).

#### Scenario: Service module is importable

- **WHEN** `from app.services.inbox.inbox_service import InboxService` is executed
- **THEN** the import MUST succeed without side effects

#### Scenario: Router carries AUTH-HARDEN marker

- **WHEN** any source-level scan of `app/api/routers/inbox/inbox_router.py` runs
- **THEN** the `list_items` route handler MUST carry an `# AUTH-HARDEN` comment within its function body or as a leading guard-line comment

#### Scenario: Source registry pattern accepts future kinds

- **WHEN** a future change appends a `TaskInboxSource` to the registry and the service's `list_items` is called
- **THEN** the route handler MUST NOT require modification; both Appointment and Task items MUST appear in the response

## ADDED Requirements

### Requirement: Orchestrator ships /_auth/inbox as the canonical caregiver attention surface

The orchestrator SHALL render at `/_auth/inbox` an `<InboxList>` showing one `<InboxItemRow>` per item returned by `GET /inbox/items`. The route SHALL be the canonical caregiver attention surface, satisfying PoC feature `F4` (renamed in `scope.md` per this change). The sidebar SHALL list a navigation item labelled `"Inbox"` pointing to this route — the existing `/_auth/inbox` placeholder (BL-065) is replaced by this real surface.

The list page SHALL use TanStack Query `useInfiniteQuery` keyed `[...inboxItemsKeyPrefix, { sort }]` with backend `page_size=25`. The page SHALL register a realtime invalidation topic when one lands (deferred for v1; placeholder hook reserves the seam).

`<InboxItemRow>` SHALL be a dispatcher that, given an `InboxItem`, looks up a row component in a registry keyed by `resourceType`. v1 registers `Appointment → <AppointmentInboxRow>`. Unknown `resourceType` values SHALL render `<UnknownInboxRow>` (muted single-line "Onbekend item type: <X>") and log a warning — the route MUST NOT throw.

#### Scenario: Inbox renders one row per item

- **WHEN** a caregiver loads `/_auth/inbox` with at least one item returned
- **THEN** the page MUST render exactly one `<InboxItemRow>` per item; for v1 each row resolves to `<AppointmentInboxRow>`

#### Scenario: Unknown resourceType falls back gracefully

- **WHEN** the backend returns an item with `resourceType: "BananaResource"` that the frontend registry does not know
- **THEN** the page MUST render `<UnknownInboxRow>` for that item with text matching `"Onbekend item type: BananaResource"`, MUST log a `console.warn`, and MUST NOT throw

#### Scenario: Sidebar lists Inbox as the entry point

- **WHEN** the sidebar renders
- **THEN** the navigation item linking to `/_auth/inbox` MUST be labelled `"Inbox"`; the previous `"Mijn patiënten"` entry pointing to `/_auth/patients` MUST be removed

### Requirement: Inbox row click opens the referenced patient in a split-pane

`<InboxItemRow>` SHALL navigate on click to `/_auth/inbox/p/$patientId` where `$patientId` is derived from the item's `subject.reference` (`"Patient/<id>"`). The route `/_auth/inbox/p/$patientId` SHALL render a 3-state master/detail layout per design.md D15: inbox list on the left (compacts to 320px rail when a patient is selected, can be fully hidden via toggle), `<PatientDetailView>` on the right.

Below the `md` breakpoint per D17, the route SHALL render the patient detail full-width without the inbox column.

#### Scenario: Row click derives patient id from subject.reference

- **WHEN** a caregiver clicks an `<AppointmentInboxRow>` whose `subject.reference === "Patient/abc-123"`
- **THEN** the orchestrator MUST navigate to `/_auth/inbox/p/abc-123`

#### Scenario: Split-pane on desktop with selected patient

- **WHEN** a caregiver loads `/_auth/inbox/p/abc-123` directly on a viewport ≥ md
- **THEN** the page MUST render the inbox list as a 320px compact rail on the left and `<PatientDetailView patient={abc-123}>` on the right

#### Scenario: Mobile fallback to full-page detail

- **WHEN** the same URL loads on a viewport < md
- **THEN** the page MUST render `<PatientDetailView>` full-width; the inbox list MUST NOT render in this viewport

### Requirement: AppointmentInboxRow row anatomy

`<AppointmentInboxRow>` SHALL render the following anatomy (left to right):

- **Subject avatar** (`<Avatar tintBy={subject.patientId}>`) — initials from `subject.display` ("Janssens, Anke" → "JA"). Never an `<img>`.
- **Identity column** (line 1: `subject.display`; line 2 muted: INSZ from `subject.identifier.value` + " · " + a future org-tree-path slot left blank in v1 since the payload does not carry it).
- **Item meta column** (right): kind tile (`<KindTile size="sm" kind={payload.kind}>`) + tabular-time formatted `occurred_at` (Dutch locale, browser-local timezone) + muted single-line `KIND_LABEL[payload.kind] · MODALITY_LABEL[payload.modality]`.
- **Kebab** trailing (visible only when the master is in full / not-collapsed state; hidden in compact rail mode).

#### Scenario: Row shows subject display and INSZ

- **WHEN** a row renders for `subject.display = "Janssens, Anke"` and `subject.identifier.value = "85.03.12-072.47"`
- **THEN** the identity column MUST show `"Janssens, Anke"` as the primary line and the INSZ value in the muted secondary line

#### Scenario: Row meta uses kind tile + tabular time

- **WHEN** a row renders for `payload.kind = "consultation"`, `payload.modality = "on_site"`, `occurred_at = "2026-06-12T14:00:00Z"` (browser TZ = `Europe/Brussels`)
- **THEN** the meta column MUST contain a consultation-tinted `<KindTile>` plus the Dutch-formatted local time and the text `"Consultatie · Op locatie"` on the muted sub-line

### Requirement: Inbox sort registry sorts items, not patients

The orchestrator SHALL define `apps/orchestrator/src/modules/inbox/sorts/index.ts` exporting `inboxSortStrategies: readonly InboxSortStrategy[]`. Each strategy has `{ id, label, queryParams }` — the registry is generic over items, not appointment-specific. `rowMeta` is NOT a registry-level concern (each row component owns its own meta rendering).

v1 strategies:
1. `next_attention` (default) — `queryParams()` returns `{ order_by: 'occurred_at', order: 'asc' }`. Earliest attention-deadline first.
2. `newly_added` — `queryParams()` returns `{ order_by: 'created_at', order: 'desc' }`. Most-recently-added source row first.

A `useSelectedInboxSort()` hook SHALL read `?sort=` via TanStack Router's `useSearch` synchronously (no flash), default to `next_attention`, and warn-log on unknown values.

#### Scenario: Default sort is next_attention

- **WHEN** a caregiver loads `/_auth/inbox` without a `sort` query param
- **THEN** the request to `GET /inbox/items` MUST include `order_by=occurred_at&order=asc`

#### Scenario: newly_added sort drives created_at descending

- **WHEN** a caregiver activates the `newly_added` strategy
- **THEN** the request MUST include `order_by=created_at&order=desc` and the URL MUST update to `?sort=newly_added`
