## ADDED Requirements

### Requirement: AGENTS.md and CLAUDE.md contain feature surface gating section

`AGENTS.md` and `CLAUDE.md` at the repo root SHALL each contain a `## Feature surface gating` section that:

- States that every new clinical page or feature module MUST declare its `surfaces` from `{app, smart, embed}`.
- Defines each surface in one sentence.
- Instructs the agent to ask the user, verbatim, the surface-selection question before writing any feature code.
- Instructs the agent to ask about FHIR resources and SMART scopes when any FHIR surface is selected.
- Instructs the agent to use `pnpm gen:feature` rather than hand-rolling feature files.
- States that defaulting to "all surfaces" or guessing is forbidden.

#### Scenario: Section present in AGENTS.md

- **WHEN** `AGENTS.md` is read
- **THEN** a heading exactly matching `## Feature surface gating` is present and contains the verbatim question and the four bullet rules

#### Scenario: Section present in CLAUDE.md

- **WHEN** `CLAUDE.md` is read
- **THEN** a heading exactly matching `## Feature surface gating` is present (may delegate to `AGENTS.md` but MUST repeat the verbatim question)

### Requirement: new-feature skill enforces the workflow

A project-local skill SHALL exist at `.claude/skills/new-feature/SKILL.md` with frontmatter:

- `name: new-feature`
- `description` mentioning triggers: "add page", "new page", "create view", "build feature", "another route", "new module".

The skill body MUST require, as numbered steps in this order:

1. Ask the user the surface-selection question (verbatim).
2. If any FHIR surface is selected, ask for FHIR resources, scopes, and required SMART context.
3. Run `pnpm gen:feature` with the answers.
4. Run `pnpm tsc -b --noEmit`, `pnpm eslint .`, `pnpm vitest run`, quote results before reporting done.

The skill MUST forbid writing feature spec, adapter, or route files by hand.

#### Scenario: Skill triggers on "add page" intent

- **WHEN** a user message contains an intent matched by the skill description (e.g. "add a new view for medications")
- **THEN** the agent invokes the `new-feature` skill before writing any code

#### Scenario: Skill enforces verification step

- **WHEN** the agent completes scaffolding
- **THEN** the agent runs the three verify commands and quotes the result before declaring done

### Requirement: Commit hook fails when defineFeature lacks surfaces

A pre-commit hook at `.claude/hooks/check-feature-surfaces.sh` SHALL be configured in `.claude/settings.json` to run on `PreToolUse:Bash` for `git commit` invocations (or as a standard git pre-commit hook). The hook MUST:

- Inspect the staged diff for new `defineFeature(` call sites.
- Fail with exit code 1 if any such call is missing a `surfaces:` field, printing a message that points to the `new-feature` skill.
- Pass through otherwise without modifying the diff.

#### Scenario: Commit fails on missing surfaces

- **WHEN** a contributor stages a new feature file containing `defineFeature({ id: 'x', path: '/x', page: X, port: XPort })`
- **THEN** the hook exits non-zero with message `defineFeature missing 'surfaces'. Run pnpm gen:feature or invoke the new-feature skill.`

#### Scenario: Commit passes on properly declared feature

- **WHEN** a contributor stages a feature whose `defineFeature` call includes `surfaces: ['app']`
- **THEN** the hook exits zero

### Requirement: Memory entry captures the gating rule

The `~/.claude/projects/<repo-slug>/memory/` directory SHALL contain a `feedback`-type memory file describing the surface-selection rule. The memory MUST be referenced from `MEMORY.md`.

#### Scenario: Memory file present

- **WHEN** the memory directory is listed
- **THEN** a file named like `feedback_feature_surface_gating.md` exists with `type: feedback` frontmatter

#### Scenario: Memory indexed

- **WHEN** `MEMORY.md` is read
- **THEN** a line referencing the gating memory file is present
