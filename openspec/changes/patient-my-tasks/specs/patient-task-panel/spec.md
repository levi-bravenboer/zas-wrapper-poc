## ADDED Requirements

### Requirement: Patient detail view surfaces the caregiver's open tasks for that patient

The patient detail view SHALL render a my-tasks panel listing the **open** tasks assigned to the **currently logged-in caregiver** for the patient in view. The panel SHALL request tasks filtered by the patient in view (`filter[patient_id]`) with status open; caller-scoping (caregiver sees own tasks; tenant-wide admin sees all assignees) is provided by the existing `/tasks` listing and is not re-implemented client-side. Each task row SHALL link to that task in the existing task inbox detail.

#### Scenario: Caregiver has open tasks for the patient

- **WHEN** a caregiver with open tasks for the patient opens that patient's detail view
- **THEN** the panel lists those open tasks (title + relative due copy)
- **AND** selecting a task navigates to its inbox detail (`/tasks/$taskId`)

#### Scenario: Newly assigned task appears without reload

- **WHEN** a task is assigned to the caregiver for the patient in view while the page is open
- **THEN** the panel reflects the new task within the polling interval, without a manual reload

### Requirement: The panel is hidden when there is no work

The panel SHALL render nothing — no card, no heading, no empty-state placeholder — when the current caregiver has no open tasks for the patient in view (including while the task list is still loading).

#### Scenario: No open tasks for this patient

- **WHEN** the caregiver has no open tasks for the patient in view
- **THEN** no my-tasks panel, heading, or empty-state is shown on the patient detail view
