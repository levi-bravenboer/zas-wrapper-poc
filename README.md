# zas-wrapper

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care. June demo target: SMART-on-FHIR launch from HiX → pathway composer → Holter / Rugrevalidatie end-to-end.

Full project context lives in [`openspec/project.md`](./openspec/project.md). Multi-agent coding rules live in [`AGENTS.md`](./AGENTS.md).

## Layout

```
zas-wrapper/
├── .moon/                # moonrepo workspace + toolchain
├── apps/
│   ├── orchestrator/     # React 19 + Vite 8 + TS 6 — clinician composer
│   └── backend/          # FastAPI + uv + Python 3.13 — FHIR gateway, MCP host
├── docs/
│   ├── research/         # research notes (agentic, HiX, Luscii)
│   ├── wireframes/       # builder HTML + transcription
│   ├── screenshots/      # design exploration
│   └── setup.md          # historical layout doc (superseded)
├── openspec/             # spec-driven change proposals + specs
├── AGENTS.md             # canonical agent instructions
├── CLAUDE.md             # Claude Code addenda
└── README.md
```

## Prerequisites

- **Node** `22.13+` — `nvm use` picks it up from `.nvmrc`.
- **Python** `3.13` — pinned in `apps/backend/.python-version`, installed automatically by `uv`.
- **uv** — `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **moon** — `curl -fsSL https://moonrepo.dev/install/moon.sh | bash`.

## Quickstart

```bash
# Install JS deps
cd apps/orchestrator && npm install && cd -

# Install Python deps + Python runtime
cd apps/backend && uv sync && cd -

# Run everything via moon
moon run orchestrator:dev      # http://localhost:5173
moon run backend:dev           # http://localhost:8000
moon run :build                # all build tasks
moon run :test                 # all test tasks
moon ci                        # affected-only build + lint + test
```

## Workflow

Spec-driven via **OpenSpec**. New behavioural changes start as proposals in `openspec/changes/` (use the `/opsx:propose` slash command in Claude Code). Implementation, verification, then archive into `openspec/changes/archive/`.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for coding standards, git rules, security posture, and per-app conventions. Each app also has its own `AGENTS.md` and `README.md`.

## License

Private. Reaktor Health consortium internal.
