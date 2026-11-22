## 1. Router extraction

- [x] 1.1 Create `src/app/router.ts` that constructs the `Router` with `context: { queryClient }`, exports the instance, and declares the `Register` module augmentation
- [x] 1.2 Update `src/app/providers.tsx` to import the router from `app/router.ts` instead of constructing inline
- [x] 1.3 Verify `routeTree.gen.ts` still regenerates without circular-import warnings

## 2. Guard helper

- [x] 2.1 Create `src/modules/auth/guard.ts` exporting `requireSession(queryClient)` that returns `SessionUser | null` via `ensureQueryData`
- [x] 2.2 Update `src/routes/_auth.tsx` `beforeLoad` to consume `context.queryClient` + `requireSession`, replacing the direct `fetchSession()` call

## 3. Logout redirect

- [x] 3.1 Update `useLogout` `onSuccess` to call `qc.clear()` then `router.navigate({ to: '/login', replace: true })`
- [x] 3.2 Ensure `useLogout`'s error path leaves the cache untouched and surfaces the error to the caller (no toast inside the hook)

## 4. Tests

- [x] 4.1 Add `modules/auth/guard.test.tsx`: verifies `requireSession` returns cached value within `staleTime`, refetches afterwards, and propagates `null` on 401
- [x] 4.2 Update `modules/auth/hooks.test.tsx`: assert `useLogout` calls `router.navigate({ to: '/login', replace: true })` after success (mock router) and does not navigate on error
- [x] 4.3 Add integration test for guard redirect: stale-cache → 401 mock → assert redirect to `/login?redirect=...`

## 5. Docs

- [x] 5.1 Add a short "router context + guards" section to `apps/orchestrator/AGENTS.md`

## 6. Verify

- [x] 6.1 `moon run orchestrator:typecheck` — must pass with strict context typing
- [x] 6.2 `moon run orchestrator:lint` — must pass
- [x] 6.3 `moon run orchestrator:test` — must pass; coverage thresholds intact
- [x] 6.4 `moon run orchestrator:test-e2e` — smoke must pass
- [x] 6.5 `moon run orchestrator:build` — must produce `dist/`
- [x] 6.6 `npx openspec validate auth-guard-router-context --strict` — must pass

<!-- greptile ignore check -->
