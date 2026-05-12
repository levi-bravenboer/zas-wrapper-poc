## Context

Current state: `_auth.tsx` `beforeLoad` calls `fetchSession()` directly. The React Query cache exists (`useSession()`) but the guard does not use it, so every guarded navigation hits `/auth/me`. With MSW this is invisible; with a real backend each transition adds a round-trip. Separately, `useLogout` clears the cache but never navigates, contradicting the existing `auth-session` spec which requires a redirect to `/login`.

Backend swap surface is already clean: `VITE_API_BASE_URL` + `VITE_API_MODE` toggle MSW vs. real fetches. The remaining issue is purely internal plumbing.

## Goals / Non-Goals

**Goals:**

- Single source of truth for session reads (Query cache).
- Guard logic is one helper, reusable for future protected boundaries.
- Logout fulfils its spec (redirect on success).
- Typed router context so future loaders/guards stay strict.

**Non-Goals:**

- Refresh-token rotation (cookie session is HttpOnly + same-site; out of scope).
- Permission/role guards (RBAC not yet modelled).
- Optimistic session prefetch on boot — `ensureQueryData` handles cold start naturally.
- Replacing `openapi-fetch`-style typed callers for the existing direct `fetch` in `auth/api.ts`; orthogonal cleanup.

## Decisions

### D1: Extract router creation into `src/app/router.ts`

Today the router is created inside `providers.tsx`. Pulling it into its own module lets `useLogout` (and any other imperative navigator) import the same instance without circular-import gymnastics through the providers tree.

```ts
// src/app/router.ts
import { createRouter } from '@tanstack/react-router'
import { queryClient } from './queryClient'
import { routeTree } from '@/routeTree.gen'

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

**Alternative**: keep router inside `providers.tsx`, export through context. Rejected — `useLogout` would need a `useRouter()` hook call, which works inside components but not from mutation callbacks composed elsewhere.

### D2: `requireSession(queryClient)` helper in `modules/auth/guard.ts`

Wraps `ensureQueryData` with the auth-specific key + queryFn + staleTime. Returns `SessionUser | null`. Routes call it from `beforeLoad`. Future admin/RBAC guards compose it (`const s = await requireSession(qc); if (!s.roles.includes('admin')) throw redirect(...)`).

### D3: Logout navigates via router instance, not via component hook

`useLogout`'s `onSuccess` calls `router.navigate({ to: '/login', replace: true })`. `replace: true` avoids polluting back-history with the just-logged-out page. The router import comes from `app/router.ts` — no `useNavigate` inside the mutation factory.

### D4: Mutation order — clear cache, THEN navigate

`qc.clear()` first so the `/login` route can't accidentally read a stale `authKeys.me()` while mounting. `router.navigate(...)` second.

### D5: 401 path stays compatible

`fetchSession` already returns `null` on 401. `ensureQueryData` caches `null` under the same key, which is exactly what subsequent guards want to see — the cache short-circuits the redirect path without an extra fetch within `staleTime`.

## Risks / Trade-offs

- **[Stale session after backend revokes cookie]** Cache could hold a positive session for up to `staleTime` (60s) after server-side revocation. → Mitigated by the existing one-shot 401 retry middleware in `lib/api/client.ts`: any guarded API call that 401s will trigger a `/auth/me` refresh and the next guard pass sees null.
- **[Circular import on `app/router.ts` ↔ `routeTree.gen`]** `routeTree.gen` is auto-generated and only imports route files; route files import from `modules/auth/guard.ts`, not from `app/router.ts`. Cycle avoided.
- **[Logout from inside `_auth` tree]** `router.navigate({ to: '/login', replace: true })` works even when the current location is being unmounted because TanStack Router queues navigations through its state machine.

## Open Questions

- Should the guard prefetch profile data (e.g. roles) once it has the session, to avoid a flash on first authed render? Decision: defer until a screen actually needs it.
