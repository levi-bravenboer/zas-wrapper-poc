import { Home } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  readonly to: string
  readonly labelKey: `nav.${string}`
  readonly icon: LucideIcon
  readonly order: number
}

// PoC ships a single hard-wired nav entry. Additional sections re-enter the
// nav by registering as features (`defineFeature({ nav: { icon, order } })`).
export const hardWiredNavItems: readonly NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: Home, order: 10 },
]
