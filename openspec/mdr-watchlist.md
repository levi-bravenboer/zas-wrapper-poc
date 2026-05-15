# MDR Watchlist

**Invariant:** we are **never** an MDR medical device (EU 2017/745). Keep this file short.

## When to add an entry

A proposal or implementation could push us toward MDR if it involves: clinical decision logic, diagnostic output, automated dosing/titration, anything used or labelled as a medical device, or interpreting Luscii measurements ourselves (instead of treating Luscii's clinical care path as an opaque sub-flow).

Stop. Add an entry. Propose a non-MDR alternative. Get a decision before proceeding.

## Entry template

```
### YYYY-MM-DD — <short title> (source: <change-name> | conversation | review>)
- **Trigger:** what would push us toward MDR.
- **Why wanted:** the use case driving the ask.
- **Non-MDR alternative:** the shape that keeps us out.
- **Decision:** chosen alternative | dropped | escalated. One line.
```

## Entries

### 2026-05-15 — patients-base scope check (source: patients-base)
- **Trigger:** none. `patients` stores identifiers (INSZ + reserved HiX namespaces) + demographics (`given_name`, `family_name`, `birth_date`, `gender`) + sync metadata (`source`, `external_*`, `last_synced_at`). No clinical state, no diagnostic logic, no decision output.
- **Why wanted:** demo orchestrator needs a tenant-scoped patient list + identifier upsert path for the Rugrevalidatie demo and the future HiX adapter.
- **Non-MDR alternative:** already chosen — separate clinical-data tables (`Encounter`, `Condition`, `Observation`) are queued behind a future change; `patients-base` keeps the row purely administrative.
- **Decision:** chosen — landed as-is. Re-verify this entry on any future field addition that introduces clinical semantics.
