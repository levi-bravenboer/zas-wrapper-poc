import { useSession } from './hooks'

// UI gating reads the session's effective RBAC permission slugs (dynamic-rbac
// Phase 8). Backend authorization (Keto + RBAC `require_permission`) stays the
// source of truth for data access; these are presentation-layer affordances.
//
// Capabilities are backend permission slugs from the catalog, EXCEPT
// frontend-only affordances that have no backend permission — those map onto a
// real catalog slug via FE_ONLY_FALLBACK so a single role grants both.
// A capability is any backend permission slug (e.g. `user.read`,
// `role.update`), plus a few frontend-only affordances that map onto a real
// slug via FE_ONLY_FALLBACK.
export type Capability = string

const FE_ONLY_FALLBACK: Record<string, string> = {
  // Skipped-step visibility has no backend permission — gate it on the
  // runtime-management permission so a single role grants both.
  'pathway.viewSkippedSteps': 'pathway.manageRuntime',
}

export function can(permissions: readonly string[] | undefined, capability: Capability): boolean {
  if (!permissions) return false
  const required = FE_ONLY_FALLBACK[capability] ?? capability
  return permissions.includes(required)
}

export function useCan(capability: Capability): boolean {
  const session = useSession()
  return can(session.data?.permissions, capability)
}

/** True when the session holds at least one of the given permission slugs. */
export function useCanAny(capabilities: readonly Capability[]): boolean {
  const session = useSession()
  const permissions = session.data?.permissions
  return capabilities.some((c) => can(permissions, c))
}
