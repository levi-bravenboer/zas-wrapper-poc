---
name: OpenAPI sync
description: Regenerate backend OpenAPI schema and orchestrator TypeScript types in lockstep. Run after any change to FastAPI routes, request/response schemas, or dependencies that affect the public surface.
category: Backend
tags: [openapi, types, typegen, backend, orchestrator, moon]
---

Backend OpenAPI schema and orchestrator generated TS types must stay in lockstep — agents routinely regen one and forget the other, leaving the frontend type-checking against a stale contract.

## Steps

1. Run `moon run backend:openapi`. This rewrites `apps/backend/openapi.json`.
2. Run `moon run orchestrator:typegen`. This consumes the JSON and regenerates the orchestrator's typed API client.
3. Check the diff: `git diff --stat apps/backend/openapi.json apps/orchestrator/`. Quote the stat output.
4. If `git diff` shows changes in `apps/orchestrator/` generated files, run `moon run orchestrator:typecheck` to confirm consumers still compile against the new types. Report any errors verbatim.
5. Report one of:
   - `openapi: no change` — neither file moved
   - `openapi: synced (N files updated, typecheck ok)` — both ran, typecheck passes
   - `openapi: synced but typecheck failed:` followed by the verbatim error tail — stop and surface to user

## Notes

- Never edit `apps/backend/openapi.json` or the generated orchestrator client by hand. They are derived artifacts.
- If the backend OpenAPI changed but the orchestrator client didn't, the typegen target is stale — check `apps/orchestrator/moon.yml` for the `typegen` task definition before assuming it's a model issue.
