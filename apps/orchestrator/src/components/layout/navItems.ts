import { Home, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  readonly to: string
  readonly labelKey: `nav.${string}`
  readonly icon: LucideIcon
  readonly order: number
}

// PoC ships hard-wired nav entries for app-surface sections. Embed/SMART
// features re-enter the nav by registering as features
// (`defineFeature({ nav: { icon, order } })`).
export const hardWiredNavItems: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home, order: 10 },
  { to: '/users', labelKey: 'nav.users', icon: Users, order: 20 },
]
