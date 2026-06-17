import { useSession } from './hooks'
import type { Role } from './schemas'

// Capability-based UI gating. Define what each role may do in one place
// instead of scattering `role === 'admin'` checks across components. Backend
// authorization (Keto) remains the source of truth for data access; these are
// presentation-layer affordances.
export type Capability =
  // Drive the pathway runtime: fast-forward, pause/cancel, complete steps,
  // edit deferred values.
  | 'pathway.manageRuntime'
  // See steps that were skipped because a past decision branched away.
  | 'pathway.viewSkippedSteps'

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: ['pathway.manageRuntime', 'pathway.viewSkippedSteps'],
  caregiver: [],
  external: [],
}

export function can(role: Role | undefined, capability: Capability): boolean {
  return role ? ROLE_CAPABILITIES[role].includes(capability) : false
}

export function useCan(capability: Capability): boolean {
  const session = useSession()
  return can(session.data?.role, capability)
}
