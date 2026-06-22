## Why

When a caregiver opens a patient's detail view, they cannot see the work **they** still owe that patient. Tasks live only in the global `/tasks` inbox; to answer "what do I have to do for *this* patient?" the caregiver must leave the patient context, open the inbox, and mentally filter. The patient page is exactly where that question is asked, so the answer belongs there.

This serves the existing `F4` caregiver-inbox / `F6` task-view surface (PoC tier) — no new feature, a placement of work already in the DB onto the page where it is acted on.

## What Changes

- **My-tasks panel on the patient detail view** — a panel rendered **between the pathway timeline and the detail tabs**, listing the **open** tasks assigned to the logged-in caregiver for the patient in view.
- **Mine only** — the panel shows tasks where `assignee = current user`. This needs no new auth logic: `GET /tasks` already restricts a caregiver's listing to their own assignments; admins (tenant-wide) see all assignees for the patient.
- **No empty placeholder** — when the caregiver has no open tasks for this patient, the panel renders **nothing** (no card, no empty-state). It only appears when there is work to surface.
- **No backend change** — `GET /tasks` already accepts the bracket filter `filter[patient_id]=<uuid>` (the task repository whitelists `patient_id` as an `eq` filter). The frontend passes the patient id; the existing caller-scoping does the rest.

## Capabilities

### New Capabilities
- `patient-task-panel`: the my-tasks panel on the patient detail view — current caregiver's open tasks for the patient in view, hidden entirely when empty, each row linking to the task in the inbox.

### Modified Capabilities
- `patient-profile-ui`: mount the my-tasks panel in the patient detail body, between the pathway timeline and the detail tabs.

## Impact

- **Frontend (orchestrator)**: a `fetchPatientTasks(patientId)` API call (reusing the generated `/tasks` client with `filter[patient_id]`), a `usePatientTasksQuery(patientId)` hook, a `PatientTasksPanel` component (reuses the existing `TaskRow` / `dueLabel`), and one mount point in `PatientProfilePage`. New i18n keys under the `tasks` namespace.
- **Backend**: none.
- **Migrations**: none.
- **Out of scope**: task creation/assignment, completing a task from the panel (rows link into the existing inbox detail), care-team ("team tasks") toggle, and any pathway-runtime task materialisation (that is the in-flight pathway runtime work).
