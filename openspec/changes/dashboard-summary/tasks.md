## 1. Confirm data contracts

- [x] 1.1 Confirm `GET /tasks` is caller-scoped and whether it accepts a `status` filter param (drives D2: server-side pending count vs client-side derive). Check the inbox (`/_auth/inbox`) for the existing pending filter + ordering and reuse it.
- [x] 1.2 Confirm the `Task` deadline + status field names and the `Page<T>.total` shape on `/patients`, `/tasks`, `/appointments` from `schema.d.ts`.

## 2. Count queries (KPI tiles)

- [x] 2.1 Add count queries reading `Page.total` with `page_size=1`: patients (`GET /patients`), pending tasks (`GET /tasks`, status-filtered per D2), appointments (`GET /appointments`). Reuse existing module query keys so the cache is shared.
- [x] 2.2 Replace each `StatTile` skeleton with the live count; render `—` on that tile's fetch error/loading-failure (keep a brief skeleton only while genuinely loading). No error boundary, no throw.
- [x] 2.3 Remove the `messages` tile from the `stats` array.

## 3. "Mijn taken" drill-down panel

- [x] 3.1 Replace the `SkeletonList` with the caller's pending tasks, sorted by deadline asc then creation, capped at 5, via the existing tasks query (D3/D6).
- [x] 3.2 Make each row a router `Link` opening the referenced patient/task (match the inbox's target route); add an empty state and a quiet inline failure state (D4).
- [x] 3.3 Add a "bekijk alles" link to `/_auth/tasks` (no `/_auth/inbox` route exists on this branch; `/tasks` is the inbox surface).

## 4. "Afspraken" drill-down panel

- [x] 4.1 Replace the second `SkeletonList` with today/upcoming appointments (cap 5, start ascending) from the existing appointments query (D3/D6); filter to now-forward client-side if `/appointments` has no date param.
- [x] 4.2 Each row is a `Link` to the appointment's drill-down target (patient detail Afspraken tab or appointment route — confirm in 1.x); add empty + quiet-failure states; add a "bekijk alles" link to the appointments surface.

## 5. i18n

- [x] 5.1 Edit `apps/orchestrator/src/lib/i18n/locales/nl/dashboard.json`: drop `stats.messages`; add keys for empty states, quiet-failure copy, and "bekijk alles". Keep every user-visible string behind `t()`.

## 6. Tests + verify

- [x] 6.1 Component test for the dashboard route: tiles show counts from mocked `Page.total`; a mocked count failure renders `—` while siblings still render; the `messages` tile is absent.
- [x] 6.2 Component test: task panel renders pending tasks sorted by deadline capped at 5, rows link to the patient/task route, empty state when none; appointments panel renders today/upcoming capped list with links.
- [x] 6.3 Verified (orchestrator): `eslint` clean on changed files; `tsc -b` passes; `vitest run` = 654 passed / 1 skipped / 6 todo, 0 failures (dashboard test: 5 passed). Note: moon's `orchestrator:typecheck` task is broken repo-wide (`tsc -b --noEmit` is an illegal combo) — typechecked via the build's `tsr generate && tsc -b` instead.
- [ ] 6.4 Browser check: log in as a caregiver, land on `/_auth/`, confirm real counts, click a task row → patient/task opens, click an appointment row → its target opens; confirm no `messages` tile and that killing one data source degrades only its section.
