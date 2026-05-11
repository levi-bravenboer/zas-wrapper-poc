# ZAS Wrapper — Repo Setup

POC/MVP for ZAS Telegeneeskunde (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care. June demo target: SMART-on-FHIR launch from HiX → pathway composer → Holter/Rugrevalidatie end-to-end.

## Layout

pnpm + Turborepo monorepo. Code in `apps/` + `packages/`. Strategy, research, design as first-class siblings.

```
zas-wrapper/
├── apps/
│   ├── web/                 # Next.js — clinician composer + SMART launch
│   ├── patient/             # patient app shell (Luscii embed/proxy)
│   └── api/                 # backend — FHIR gateway, MCP server
├── packages/
│   ├── ui/                  # shared design system (designer ↔ dev handoff)
│   ├── fhir-client/         # HiX FHIR + SMART helpers
│   ├── mcp-server/          # MCP layer
│   ├── pathway-engine/      # composer runtime
│   └── config/              # tsconfig, eslint, tailwind presets
├── docs/
│   ├── strategy/            # pitch, decisions, ADRs
│   ├── requirements/        # Lastenboek breakdown, REQ traceability
│   ├── architecture/        # diagrams, module map, FHIR flows
│   ├── demo/                # June demo script, scenarios
│   └── meetings/            # consortium notes (Luscii, NewWave)
├── design/
│   ├── pencil/              # .pen files
│   ├── exports/             # PNG/SVG handoffs
│   └── tokens/              # design tokens → packages/ui
├── research/
│   ├── fhir-belgium/        # Caresets, SHDR, openEHR notes
│   ├── mcp/                 # MCP spec, version research
│   ├── hix-chipsoft/        # SMART launch quirks
│   └── competitors/         # Luscii, ChipSoft modules
├── scripts/                 # dev tooling, FHIR mock seeds
├── .github/workflows/       # CI
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── README.md
└── CLAUDE.md                # repo conventions
```

## Rationale

- **apps/packages**: real monorepo. Turborepo caches builds across composer + API + MCP.
- **docs/research**: strategy + REQ traceability lives next to code, not in Notion drift.
- **design/**: first-class folder. Designer commits `.pen` + tokens flow into `packages/ui`.
- **REQ traceability** in `docs/requirements/`: maps Lastenboek REQ-IDs → modules → tests. Scored asset for jury.

## Module → folder mapping

From strategy doc §4.1, sixteen modules map to packages/apps:

| Module | Location |
| :---- | :---- |
| 1 Identity & Access (Belgian) | `apps/api` + `packages/fhir-client` (SMART) |
| 2 FHIR Integration Gateway (HiX) | `apps/api` + `packages/fhir-client` |
| 3 Master-Data Sync | `apps/api` |
| 4 Pathway Composer | `apps/web` + `packages/pathway-engine` |
| 5 Patient Engagement App | `apps/patient` (Luscii embed) |
| 6 Clinical Engine | external — Luscii |
| 7 Device Connectivity | `apps/api` (Holter), Luscii core |
| 8 Questionnaires/PROMs/ICHOM | `apps/api` + `packages/pathway-engine` |
| 9 Messaging/Video/e-Signing | Luscii + `apps/api` (e-sign) |
| 10 Booking & Scheduling Sync | `apps/api` |
| 11 Transmural Sharing & e-Refferal | `apps/api` |
| 12 Tolk Booking | `apps/api` |
| 13 Notification Orchestration | `apps/api` |
| 14 MCP / AI Integration | `packages/mcp-server` |
| 15 Data Platform (SHDR + OMOP) | out-of-repo infra, contracts in `apps/api` |
| 16 Ops/Observability/Audit | cross-cutting, configs in `packages/config` |

## Stack defaults (confirm)

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui in `packages/ui`
- **Backend**: Hono on Node (lightweight, edge-ready) — alternative tRPC if end-to-end TS preferred
- **FHIR**: `fhir-kit-client` or `@medplum/core` for R4
- **MCP**: official `@modelcontextprotocol/sdk`
- **Auth**: NextAuth + custom Belgian IdP adapters (eHealth, itsme®, eID, CSAM) — POC stub first
- **DB**: Postgres + Drizzle ORM. SHDR/OMOP out-of-scope for POC
- **Tooling**: pnpm, Turborepo, Biome (lint+format), Vitest, Playwright

## REQ traceability format

`docs/requirements/REQ-NON-4.md` template:

```markdown
---
id: REQ-NON-4
theme: SMART on FHIR launch from HiX
priority: veto
modules: [1, 2, 4]
status: planned | in-progress | demo-ready
owner: NewWave Care
---

# Description
Platform must be callable from ZAS HiX via SMART on FHIR launch.

# Acceptance
- Click in HiX opens platform in correct patient + clinician context
- Audited launch event
- Demo-day scenario: ...

# Implementation
- `packages/fhir-client/smart-launch.ts`
- `apps/web/app/launch/route.ts`

# Tests
- `apps/web/test/smart-launch.spec.ts`
```

Same template for all veto-grade REQs (NON-1, 4, 16, 17, 18, 19, 20) plus scored functional REQs (FUN-72, 114, 124, 167, 176).

## Demo delivery order (MVP)

Per strategy doc §5.1: Holter → Rugrevalidatie → Pneumologie → Oncologie → Blaaskanker.

POC repo focus for June: Holter integration + Rugrevalidatie composer flow. Other trajecten scaffolded but not live.

## Open questions

1. Stack confirmed? Next.js + Hono + Drizzle, or different?
2. Designer using Pencil (`.pen`) or Figma? Affects `design/` subfolders
3. Git init now or later?
4. Hosting target — Belgian cloud (must per REQ-NON), local Docker for POC?

## Next steps

1. Decide stack questions above
2. Scaffold `pnpm-workspace.yaml`, `turbo.json`, `package.json`
3. Bootstrap `apps/web` (Next.js) + `apps/api` (Hono) + `packages/ui`
4. Drop pitch into `docs/strategy/zas-platform-analysis.md`
5. Seed `docs/requirements/` with veto-grade REQs
6. First commit: `chore: scaffold monorepo`
