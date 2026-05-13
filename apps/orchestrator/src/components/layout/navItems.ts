import { Home, Settings, Users, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  readonly to: string
  readonly labelKey: `nav.${string}`
  readonly icon: LucideIcon
  readonly order: number
}

// Hard-wired nav entries. Each one will migrate into a feature module under
// `modules/<id>/` (registered via `defineFeature`) in step 7. Until then the
// Sidebar merges these with the feature registry, sorting by `order`.
export const hardWiredNavItems: readonly NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: Home, order: 10 },
  { to: '/pathways', labelKey: 'nav.pathways', icon: Workflow, order: 30 },
  { to: '/patients', labelKey: 'nav.patients', icon: Users, order: 40 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, order: 50 },
]
