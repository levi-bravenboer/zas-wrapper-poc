import { useSession } from './hooks'

// Capability-based UI gating, keyed by the bound role's slug. Backend
// authorization (Keto + RBAC permissions) remains the source of truth for data
// access; these are presentation-layer affordances. (Interim: a fuller
// `can(slug)` over session `permissions` is dynamic-rbac Phase 8.)
export type Capability =
  // Drive the pathway runtime: fast-forward, pause/cancel, complete steps,
  // edit deferred values.
  | 'pathway.manageRuntime'
  // See steps that were skipped because a past decision branched away.
  | 'pathway.viewSkippedSteps'

const ROLE_CAPABILITIES: Record<string, readonly Capability[]> = {
  admin: ['pathway.manageRuntime', 'pathway.viewSkippedSteps'],
  default: [],
}

export function can(roleSlug: string | undefined, capability: Capability): boolean {
  return roleSlug ? (ROLE_CAPABILITIES[roleSlug] ?? []).includes(capability) : false
}

export function useCan(capability: Capability): boolean {
  const session = useSession()
  return can(session.data?.role_slug, capability)
}
