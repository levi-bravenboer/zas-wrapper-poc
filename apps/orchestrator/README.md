# orchestrator

Clinician composer + SMART-on-FHIR launch surface for the ZAS Telegeneeskunde POC.

Stack: **React 19.2** + **Vite 8** (Rolldown) + **TypeScript 6** + **TanStack Router/Query/Form** + **Tailwind v4** + **shadcn/ui** + **i18next** (`nl`) + **Vitest** + **Playwright** + **MSW**.

## Requirements

- Node `>=22.13` (Rolldown native bindings fail silently on older Node).
- npm 10+.

`nvm use` from repo root picks up `.nvmrc`.

## Bootstrap

```bash
nvm use
cd apps/orchestrator
npm install --legacy-peer-deps
npm run typegen          # regenerates src/lib/api/schema.d.ts from http://localhost:8000/openapi.json
npm run dev              # http://localhost:5173 — MSW mock by default (VITE_API_MODE=mock)
```

Copy `.env.example` → `.env` if you need to point at a different backend or disable mocks (`VITE_API_MODE=live`).

## Commands

Always prefer **moon** — it caches + only runs affected tasks:

```bash
moon run orchestrator:dev
moon run orchestrator:build
moon run orchestrator:typecheck
moon run orchestrator:lint
moon run orchestrator:format
moon run orchestrator:test
moon run orchestrator:test-e2e
moon run orchestrator:typegen
moon run orchestrator:preview
```

Direct npm scripts mirror the moon tasks (`npm run dev`, `npm run test`, …) but bypass the cache — only use them ad-hoc.

## Structure

```
apps/orchestrator/
├── src/
│   ├── app/                  # provider tree, router, error boundary, query client
│   ├── routes/               # TanStack Router file-based routes (default-export allowed here)
│   ├── modules/              # vertical slices (auth/, smart-launch/, …)
│   │   └── <name>/
│   │       ├── api.ts
│   │       ├── hooks.ts
│   │       ├── schemas.ts
│   │       ├── keys.ts
│   │       ├── constants.ts
│   │       ├── components/
│   │       └── __tests__/
│   ├── components/
│   │   ├── ui/               # shadcn primitives (Button, Input, Card, Form, Label, Toast, Icon)
│   │   └── app/              # app-wide composed blocks
│   ├── hooks/                # cross-feature hooks
│   ├── lib/
│   │   ├── api/              # openapi-fetch client + generated schema.d.ts
│   │   ├── query/            # createQueryKeys helper, QueryClient config lives in app/
│   │   ├── form/             # TanStack Form + Zod adapters
│   │   ├── fhir/             # SMART helpers
│   │   ├── i18n/             # i18next bootstrap + nl locale
│   │   ├── style/            # cn() helper
│   │   └── utils/
│   ├── config/
│   ├── stores/               # zustand stores
│   ├── styles/               # tokens.css + globals.css
│   ├── test/                 # setup.ts + renderWithProviders
│   ├── mocks/                # MSW handlers, server.ts (Node), browser.ts (SW)
│   └── types/
├── tests-e2e/                # Playwright specs
├── public/                   # static assets + mockServiceWorker.js
├── biome.json                # format + import sort
├── eslint.config.js
├── playwright.config.ts
├── vitest.config.ts
├── vite.config.ts
├── tsconfig*.json
├── moon.yml
├── AGENTS.md
└── README.md
```

## Conventions

See [`AGENTS.md`](./AGENTS.md) for layout, naming, casing, testing, and SMART-on-FHIR rules.
