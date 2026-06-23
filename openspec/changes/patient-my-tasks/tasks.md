## 1. Prototype + pick a look

- [x] 1.1 Build panel prototypes in `prototypes/my-tasks/` (v1: card/inline/strip, v2: horizontal blocks, v3: horizontal blocks in inbox style)
- [x] 1.2 Chosen: **v3** — horizontal snap-scroll blocks, `TaskRow` vocabulary, prev/next arrows; card click → existing full detail at `/_auth/tasks/$taskId/`

## 2. Data layer (frontend only — no backend change)

- [x] 2.1 Reused the canonical `usePaginatedQuery` + `serializeListQuery` infra (no new `api.ts` fn): the hook passes `filter[patient_id]` + `filter[status]=open` via the bracket envelope
- [x] 2.2 Confirmed the wire format matches `app/api/_list/deps.py`; bracket filters are not in the typed query (parsed from the raw request) so the shared `querySerializer` is the established path — no schema regen
- [x] 2.3 Added `usePatientTasksQuery(patientId)` in `modules/tasks/hooks.ts` (15s `refetchInterval`, parity with `useTasksQuery`); key via `paginatedQueryKey`
- [x] 2.4 No new key needed — `paginatedQueryKey('/tasks', query)` keys the patient-scoped query

## 3. Panel component

- [x] 3.1 Built `PatientTasksPanel({ patientId })` — horizontal snap-scroll rail of task cards (v3), prev/next arrow buttons + native scroll; cards reuse `Circle` icon, `dueLabel`, primary-soft status chip
- [x] 3.2 Card is a `Link to="/tasks/$taskId"` → existing full detail (no new detail view); overdue due-copy in `destructive`
- [x] 3.3 Returns `null` when loading or when the list is empty (no rail, no heading, no empty-state)
- [x] 3.4 Added `panel.{title,subtitle,prev,next}` to `nl/tasks.json` (only nl locale exists)

## 4. Mount + verify

- [x] 4.1 Mounted `<PatientTasksPanel patientId={patient.id} />` in `PatientProfilePage` between `<PathwayTimeline>` and `<EntityDetailTabs>` (body is `flex flex-col gap-3` → gap collapses when panel is null)
- [x] 4.2 Unit test `PatientTasksPanel.test.tsx`: renders nothing when loading/empty; one card per task + count; cards link to `/tasks/$taskId`
- [x] 4.3 Verified orchestrator: typecheck clean, lint passes (0 errors), 633 tests pass incl. `PatientTasksPanel.test.tsx`
- [ ] 4.4 Browser check (pending — dev stack not running): patient with open tasks shows the panel above the tabs; patient without shows timeline-then-tabs, no gap
