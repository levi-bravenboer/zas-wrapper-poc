# orchestrator

Clinician composer + SMART-on-FHIR launch surface for the ZAS Telegeneeskunde POC.

Stack: **React 19.2** + **Vite 8** (Rolldown) + **TypeScript 6** + ESLint 10 flat config.

## Requirements

- Node `>=22.13` (Rolldown native bindings fail silently on older Node).
- npm 10+.

`nvm use` from repo root picks up `.nvmrc`.

## Commands

Direct:

```bash
npm install
npm run dev         # http://localhost:5173
npm run build       # tsc -b && vite build → dist/
npm run lint
npm run preview
```

Through moon (preferred — caches + affected-detection):

```bash
moon run orchestrator:dev
moon run orchestrator:build
moon run orchestrator:typecheck
moon run orchestrator:lint
```

## Conventions

See [`AGENTS.md`](./AGENTS.md) for layout, styling, and SMART-on-FHIR rules. Highlights:

- TypeScript strict, no unexplained `any`.
- Function components only.
- Treat all FHIR payloads as PHI — no real patient data in fixtures or screenshots.

## Structure

```
apps/orchestrator/
├── src/                   # app source (flat for now)
├── public/                # static assets
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── moon.yml
├── AGENTS.md
└── README.md
```
