## Why

The `_auth` route guard calls `fetchSession()` directly instead of going through the React Query cache, so every guarded navigation refetches `/auth/me`. With a real backend this becomes a round-trip per nav. Also, `useLogout` clears the Query cache but does not redirect — the `auth-session` spec already requires a redirect to `/login`, but the implementation lags. Tightening these two gaps now means zero refactor when the FastAPI backend replaces MSW.

## What Changes

- Pass a typed router `context` containing `queryClient` from `providers.tsx` to the router instance
- Update `_auth.tsx` `beforeLoad` to use `context.queryClient.ensureQueryData` against the session query key (reuses cache, respects `staleTime`)
- Update `useLogout` to navigate to `/login` after the cache clears, fulfilling the existing spec requirement
- Add a `requireSession()` helper in `modules/auth/guard.ts` so future protected boundaries (admin, etc.) reuse the same loader-aware pattern
- Add tests: guard hits cache when fresh, refetches when stale, redirects on null; logout navigates to `/login`

## Capabilities

### Modified Capabilities

- `auth-session`: Adds a router-context-aware guard helper, requires session reads through React Query cache, and tightens the existing logout-redirect requirement to match implementation.
- `routing`: Router instance now declares a typed context with `queryClient`; `_auth` guard consumes it.

## Impact

- **Code**: `src/app/providers.tsx` (or wherever the router is created), `src/app/router.ts` (new — extracts router creation), `src/routes/_auth.tsx`, `src/modules/auth/hooks.ts`, new `src/modules/auth/guard.ts`.
- **Tests**: New `modules/auth/guard.test.tsx`; update existing `hooks.test.tsx` for logout redirect.
- **Dependencies**: none.
- **Backend swap surface**: `VITE_API_MODE` + `VITE_API_BASE_URL` already abstract the boundary; no further env work.
- **Docs**: Note router-context pattern in `apps/orchestrator/AGENTS.md`.
