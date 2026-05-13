# openspec-process Specification

## Purpose
TBD - created by archiving change define-poc-scope. Update Purpose after archive.
## Requirements
### Requirement: Tier-tagged change proposals

Every active change proposal under `openspec/changes/<name>/proposal.md` SHALL cite exactly one tier — `[poc]`, `[mvp]`, or `[product]` — on a `**Tier**:` line near the top of the file. Out-of-tier work SHALL be recorded in `openspec/backlog.md` as a `BL-NNN` entry instead of being opened as an active change.

#### Scenario: Proposal cites a tier

- **WHEN** an author runs `/opsx:propose` to create a new change
- **THEN** the generated `proposal.md` includes a `**Tier**: [poc] | [mvp] | [product]` line near the top
- **AND** the proposal references any `BL-NNN` backlog item it promotes

#### Scenario: Proposal omits the tier

- **WHEN** a reviewer opens a `proposal.md` lacking a `**Tier**:` line
- **THEN** the change is considered malformed
- **AND** the reviewer either asks the author to add the tier or moves the idea to `openspec/backlog.md`

#### Scenario: Idea is out-of-tier for the current scope window

- **WHEN** an author wants to propose work whose tier is not in the current scope window per `openspec/scope.md`
- **THEN** the author adds a `BL-NNN` entry to `openspec/backlog.md` with title, tier, source, and a one-paragraph note
- **AND** the author does NOT create a folder under `openspec/changes/`

### Requirement: Scope re-read before implementation

Implementers SHALL re-read `openspec/scope.md` before starting tasks for any change. If `scope.md` has drifted such that the change is no longer in-tier, the implementer SHALL pause and propose a scope edit before writing code.

#### Scenario: Scope matches when implementation starts

- **WHEN** an implementer begins tasks for a change
- **THEN** they confirm the change's tier still matches `openspec/scope.md`'s current scope window
- **AND** proceed with implementation

#### Scenario: Scope has drifted since proposal

- **WHEN** the implementer finds `scope.md` no longer matches the change's tier
- **THEN** they pause implementation
- **AND** propose a scope edit (or a re-tier of the change) before writing code

### Requirement: Backlog parking for out-of-tier findings during implementation

When a task uncovers out-of-tier work, the implementer SHALL add a `BL-NNN` entry to `openspec/backlog.md` and continue with the original task. Out-of-tier work SHALL NOT be silently added to the active change.

#### Scenario: Mid-task finding requires deferral

- **WHEN** an implementer discovers an out-of-tier requirement while completing a task
- **THEN** they add a new `BL-NNN` entry to `openspec/backlog.md` with tier, source ("found while implementing change `<name>`"), and a one-paragraph note
- **AND** they complete the originally scoped task without expanding the change

### Requirement: Living scope ledger maintained per change

`openspec/scope.md` SHALL be edited in the same change that adds, removes, or re-tiers a feature, mock, or PoC → MVP delta entry. Edits SHALL land in the same commit / PR as the change proposal that motivates them.

#### Scenario: Feature added to scope

- **WHEN** a change introduces a new in-scope feature
- **THEN** `openspec/scope.md` "PoC In-Scope" section gains a new `Fn` entry with tier + one-line acceptance
- **AND** the edit is in the same PR as `proposal.md`

#### Scenario: Mock promoted to real

- **WHEN** a change replaces a mock with a real integration
- **THEN** the matching row in `openspec/scope.md` "PoC Mocks" table is removed
- **AND** the matching row in "PoC → MVP Delta" is updated to reflect the new state

### Requirement: OpenSpec file map present in agent docs

The root `AGENTS.md` SHALL contain an "OpenSpec File Map" section enumerating every artifact under `openspec/` (`project.md`, `scope.md`, `backlog.md`, `changes/`, `changes/archive/`, `specs/`, `AGENTS.md`) with a one-line description and "when to read" hint. `openspec/AGENTS.md` SHALL contain the full map plus usage examples. Per-app `AGENTS.md` files SHALL include a short pointer ("Before implementing any task, re-read `openspec/scope.md` to confirm in-tier.") and a reference to `openspec/AGENTS.md`.

#### Scenario: Onboarding agent reads root AGENTS.md

- **WHEN** an agent loads root `AGENTS.md`
- **THEN** it sees the OpenSpec File Map section
- **AND** it sees the Scope Discipline rules (tier tag, scope re-read, backlog parking)

#### Scenario: Agent works inside an app folder

- **WHEN** an agent loads `apps/backend/AGENTS.md` or `apps/orchestrator/AGENTS.md`
- **THEN** it sees the one-line "re-read scope.md" reminder
- **AND** it sees a pointer to `openspec/AGENTS.md` for the full openspec rules

