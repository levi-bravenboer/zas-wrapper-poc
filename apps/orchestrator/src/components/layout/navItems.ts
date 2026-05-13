import { Home, ListTodo, Settings, Users, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavRoute = '/dashboard' | '/taken' | '/zorgpaden' | '/patienten' | '/instellingen'

export type NavItem = {
  to: NavRoute
  labelKey: `nav.${string}`
  icon: LucideIcon
}

export const navItems: readonly NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
  { to: '/taken', labelKey: 'nav.taken', icon: ListTodo },
  { to: '/zorgpaden', labelKey: 'nav.zorgpaden', icon: Workflow },
  { to: '/patienten', labelKey: 'nav.patienten', icon: Users },
  { to: '/instellingen', labelKey: 'nav.instellingen', icon: Settings },
]
