import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Calendar,
  Contact,
  Home,
  Inbox,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react'

import type { Capability } from '@/modules/auth/permissions'
import type { Role } from '@/modules/auth/schemas'

// labelKey is a fully-qualified i18next key in `namespace:path.to.key` form so
// the sidebar can pull from multiple namespaces without per-call useTranslation
// boilerplate.
export type NavLabelKey = `${string}:${string}`

export type NavItem = {
  readonly to: string
  readonly labelKey: NavLabelKey
  readonly icon: LucideIcon
  readonly order: number
  readonly requiresRole?: readonly Role[]
  /** Hide when the session lacks this RBAC permission slug. */
  readonly requiresPermission?: Capability
}

export type NavGroup = {
  readonly id: 'top' | 'beheer' | 'footer'
  readonly labelKey?: NavLabelKey
  readonly collapsible?: boolean
  readonly placement: 'main' | 'footer'
  readonly requiresRole?: readonly Role[]
  readonly requiresPermission?: Capability
  readonly items: readonly NavItem[]
}

// Single source of truth for sidebar inventory. Filtering by role happens in
// AppSidebar before render; entries with `requiresRole` MUST NOT appear in the
// DOM for sessions whose role is not listed.
export const navGroups: readonly NavGroup[] = [
  {
    id: 'top',
    placement: 'main',
    items: [
      { to: '/', labelKey: 'nav:dashboard', icon: Home, order: 10 },
      { to: '/patients', labelKey: 'nav:patients', icon: Contact, order: 12 },
      { to: '/appointments', labelKey: 'nav:appointments', icon: Calendar, order: 15 },
      { to: '/tasks', labelKey: 'nav:tasks', icon: Inbox, order: 20 },
      {
        to: '/pathways',
        labelKey: 'nav:pathways',
        icon: Workflow,
        order: 40,
        requiresPermission: 'pathway.read',
      },
    ],
  },
  {
    id: 'beheer',
    labelKey: 'caregiver-shell:group.beheer',
    collapsible: true,
    placement: 'main',
    requiresRole: ['admin'],
    items: [
      {
        to: '/admin/users',
        labelKey: 'caregiver-shell:nav.users',
        icon: Users,
        order: 10,
        requiresRole: ['admin'],
      },
      {
        to: '/admin/roles',
        labelKey: 'caregiver-shell:nav.roles',
        icon: ShieldCheck,
        order: 11,
        requiresRole: ['admin'],
      },
      {
        to: '/admin/organisations',
        labelKey: 'caregiver-shell:nav.organisations',
        icon: Building2,
        order: 20,
        requiresRole: ['admin'],
      },
      {
        to: '/admin/practitioner-roles',
        labelKey: 'caregiver-shell:nav.practitionerRoles',
        icon: UsersRound,
        order: 30,
        requiresRole: ['admin'],
      },
      {
        to: '/admin/audit-log',
        labelKey: 'caregiver-shell:nav.auditLog',
        icon: ScrollText,
        order: 40,
        requiresRole: ['admin'],
      },
    ],
  },
  {
    id: 'footer',
    placement: 'footer',
    items: [
      {
        to: '/settings',
        labelKey: 'caregiver-shell:nav.settings',
        icon: Settings,
        order: 10,
      },
    ],
  },
]

// Feature-registered nav entries (defineFeature({ nav })) still merge here.
export const hardWiredNavItems: readonly NavItem[] = navGroups.find((g) => g.id === 'top')!.items
