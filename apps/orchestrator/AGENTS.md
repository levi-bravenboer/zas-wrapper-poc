# AGENTS.md — apps/orchestrator

Frontend app: clinician composer + SMART-on-FHIR launch surface. Inherits all rules from the root `AGENTS.md`; this file overrides where it differs.

## Stack

- React 19.2
- Vite 8 (uses Rolldown — requires Node >= 22.13 or 20.19)
- TypeScript 6 (strict)
- ESLint 10 flat config with `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`

## Commands

Run from `apps/orchestrator/`:

```bash
npm install         # bootstrap (Node 22+ required; nvm use 22)
npm run dev         # vite dev server
npm run build       # tsc --build + vite build → dist/
npm run lint        # eslint
npm run preview     # serve built dist/
```

Type-check only: `npx tsc -b --noEmit`.

## Conventions

- **File layout**: `src/` is flat for now. Introduce `src/features/<name>/` once a feature spans more than three files.
- **Components**: function components only. Default export per file when the file holds one component; otherwise named exports.
- **State**: prefer local state and URL state. Reach for a store (Zustand, Redux) only when justified in an OpenSpec proposal.
- **Data fetching**: not wired yet. When added, isolate API calls in `src/lib/api/` with types generated from the backend's OpenAPI schema.
- **Styling**: scoped CSS modules or Tailwind utilities. Design system package lands later — do not invent global utility classes meanwhile.
- **Imports**: absolute imports configured via `tsconfig` `paths` once introduced; until then, relative imports.

## Quality Gates

Before claiming a task complete:

1. `npm run lint` — clean.
2. `npx tsc -b --noEmit` — no errors.
3. `npm run build` — green.
4. For UI changes: load the affected route in `npm run dev` and verify the golden path manually. If the user cannot run it, say so explicitly.

## SMART-on-FHIR Notes

- Launch flow lives behind `/launch` (planned). Never log launch tokens or `state` parameters.
- Treat all FHIR payloads as PHI. No real patient data in fixtures, Storybook, or screenshots.

## Node / Engine

Pin Node `>=22.13` in `package.json` engines when you next touch dependency management. Rolldown native binding fails silently on older versions.
