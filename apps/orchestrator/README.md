# orchestrator

Clinician composer + SMART-on-FHIR launch surface for the ZAS Telegeneeskunde POC.

Stack: **React 19.2** + **Vite 8** (Rolldown) + **TypeScript 6** + **TanStack Router/Query/Form** + **Tailwind v4** + **shadcn/ui** + **i18next** (`nl`) + **Vitest** + **Playwright** + **MSW**.

## Requirements

- Node `>=22.13` (Rolldown native bindings fail silently on older Node).
- pnpm 9+.

`nvm use` from repo root picks up `.nvmrc`. Install pnpm via `corepack enable` or `npm i -g pnpm@9`.

## Bootstrap

```bash
nvm use
cd apps/orchestrator
pnpm install
pnpm run typegen          # regenerates src/lib/api/schema.d.ts from http://localhost:18000/openapi.json
pnpm run dev              # http://localhost:5173 — MSW mock by default (VITE_API_MODE=mock)
```

Copy `.env.example` → `.env` if you need to point at a different backend or disable mocks (`VITE_API_MODE=live`).

The orchestrator stays native (Vite HMR). It reaches the docker-hosted backend on `http://localhost:18000` (container-internal `:8000`) via the published port — no docker network rewriting needed. Boot the full stack from repo root with `moon run :up`.

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

Direct pnpm scripts mirror the moon tasks (`pnpm run dev`, `pnpm run test`, …) but bypass the cache — only use them ad-hoc.

## Demo login

The PoC seeds two users in the `zas` tenant. Use them against a running backend:

| Email                 | Password env var                       | Fallback (non-prod) |
| --------------------- | -------------------------------------- | ------------------- |
| `admin@zas.local`     | `BACKEND_BOOTSTRAP_ADMIN_PASSWORD`     | `changeme`          |
| `caregiver@zas.local` | `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` | `changeme`          |

In `production`, the seed script refuses to run unless both env vars are set.
See `scripts/seed_users.py` in `apps/backend/`.

## Structure

```
apps/orchestrator/
├── src/
│   ├── app/                  # provider tree, router, error boundary, query client
│   ├── routes/               # TanStack Router file-based routes (default-export allowed here)
│   ├── modules/              # vertical slices (auth/, …)
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
│   │   ├── layout/           # AppLayout, Sidebar, SectionPlaceholder, navItems
│   │   └── app/              # app-wide composed blocks
│   ├── hooks/                # cross-feature hooks
│   ├── lib/
│   │   ├── api/              # openapi-fetch client + generated schema.d.ts
│   │   ├── query/            # createQueryKeys helper, QueryClient config lives in app/
│   │   ├── form/             # TanStack Form + Zod adapters
│   │   ├── fhir/             # FHIR-ready helpers (returns at [mvp])
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

## Routes

Routes are split across three surface segments:

- `_auth/*` — `app` surface (orchestrator session, sidebar chrome). Hand-written for admin/pathway pages; `renderFeature` shim for registry-driven features.
- `s/*` — `smart` surface (SMART-on-FHIR launch, sidebar chrome). Always `renderFeature` shim.
- `embed/*` — `embed` surface (HiX iframe, bare chrome). Always `renderFeature` shim.

| Path                       | Surface | Auth | Notes                                                              |
| -------------------------- | ------- | ---- | ------------------------------------------------------------------ |
| `/login`                   | —       | no   | Reads `?redirect` to restore intended destination                  |
| `/launch`, `/launch/callback` | —    | no   | SMART-on-FHIR PKCE entry + callback                                |
| `/`                        | app     | yes  | redirect → `/dashboard` (`_auth/index.tsx` `beforeLoad`)           |
| `/dashboard`               | app     | yes  | Caregiver workspace home (hand-written, app-only)                  |
| `/tasks`                   | app     | yes  | Registry feature (`tasksFeature`); also `/s/tasks`, `/embed/tasks` |
| `/patients/*`              | app     | yes  | Patient list + detail (`modules/patient/`, hand-written)           |
| `/users`, `/users/$id`     | app     | yes  | User list + detail (`modules/user/`, hand-written, app-only)       |
| `/pathways/*`              | app     | yes  | Pathway composer (admin opt-out, app-only forever)                 |
| `/admin/*`                 | app     | yes  | Organisations, practitioner roles, users (admin opt-out)           |
| `/s/tasks`                 | smart   | yes  | Registry feature mounted on `SmartShell`                           |
| `/embed/tasks`             | embed   | yes  | Registry feature mounted on `EmbedShell`                           |

`_auth/*` mounts `AppShell` (sidebar + main). `s/*` mounts `SmartShell` (sidebar + SMART context). `embed/*` mounts `EmbedShell` (bare + SMART context + postMessage host bridge). See `src/platform/README.md` for the platform model and `page-surface-catalogue.md` in the active or archived `multi-surface-feature-framework` openspec change for canonical page → surface decisions.

## Embed surface (HiX iframe)

Routes under `/embed/*` are designed to be hosted inside an EPD iframe. The orchestrator origin MUST be served with a CSP header that allow-lists the host:

```
Content-Security-Policy: frame-ancestors https://hix.example.com https://*.epd.example;
```

- **Do not** set `X-Frame-Options: DENY` / `SAMEORIGIN` — it overrides `frame-ancestors` and breaks the iframe surface.
- The allow-list lives in `VITE_EMBED_FRAME_ANCESTORS` (space-separated origins); the deployment manifest (reverse proxy, S3 metadata, edge worker, …) reads it and emits the CSP header verbatim.
- `VITE_EMBED_HOST_ORIGIN` is the **single** origin the embed surface uses as `postMessage` target and inbound-message origin check. It MUST be one of the origins in `VITE_EMBED_FRAME_ANCESTORS`. When unset, the host bridge is a no-op (development default).

## postMessage host protocol

The embed shell exchanges typed JSON messages with the parent window. Every message carries `{ source: 'zas-embed', type, ... }`.

Outbound (embed → host):

| `type`     | Payload                | Sent when                                    |
| ---------- | ---------------------- | -------------------------------------------- |
| `ready`    | —                      | Embed boot completes                         |
| `resize`   | `{ height: number }`   | Root container content size changes          |
| `navigate` | `{ path: string }`     | Router resolves a new location               |
| `close`    | —                      | Caregiver dismisses the embed                |
| `error`    | `{ code, message }`    | SMART exchange or render-time failure        |

Inbound (host → embed) is restricted to `host-navigate` / `host-context`. The bridge verifies `event.origin === VITE_EMBED_HOST_ORIGIN` before dispatching.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for layout, naming, casing, testing, and SMART-on-FHIR rules.
