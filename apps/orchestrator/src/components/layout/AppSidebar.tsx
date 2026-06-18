import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
} from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/style/cn'
import { initials } from '@/lib/utils/initials'
import { useLogout, useSelectRole, useSession, useSessionRoles } from '@/modules/auth/hooks'
import type { Role } from '@/modules/auth/schemas'
import { getFeaturesForSurface } from '@/platform/embed/defineFeature'

import { navGroups, type NavGroup, type NavItem } from './navItems'

function passesRole(role: Role | undefined, required: readonly Role[] | undefined): boolean {
  if (!required || required.length === 0) return true
  if (!role) return false
  return required.includes(role)
}

function useResolvedNavGroups(): readonly NavGroup[] {
  const { data: session } = useSession()
  const role = session?.role_slug

  return useMemo(() => {
    // Feature-registered items still inject into the top group, preserving
    // legacy behaviour for SMART/embed surfaces.
    const featureItems = getFeaturesForSurface('app').flatMap<NavItem>((feature) =>
      feature.nav
        ? [
            {
              to: feature.path,
              labelKey: feature.titleKey.replace(/^nav\./, 'nav:') as NavItem['labelKey'],
              icon: feature.nav.icon,
              order: feature.nav.order ?? 100,
            },
          ]
        : [],
    )

    return navGroups
      .filter((group) => passesRole(role, group.requiresRole))
      .map((group) => {
        const baseItems = group.id === 'top' ? [...group.items, ...featureItems] : [...group.items]
        const items = baseItems
          .filter((item) => passesRole(role, item.requiresRole))
          .toSorted((a, b) => a.order - b.order)
        return { ...group, items }
      })
      .filter((group) => group.items.length > 0)
  }, [role])
}

export function AppSidebar(): ReactElement {
  const groups = useResolvedNavGroups()
  const mainGroups = groups.filter((g) => g.placement === 'main')
  const footerGroups = groups.filter((g) => g.placement === 'footer')

  return (
    <Sidebar
      variant="sidebar"
      side="left"
      collapsible="icon"
      className={cn(
        'glass border-r-0',
        '[&>[data-slot=sidebar-container]]:rounded-none',
        '[&>[data-slot=sidebar-container]]:border-r-0',
      )}
    >
      <SidebarHeader className="px-3 py-4">
        <BrandBlock />
      </SidebarHeader>
      <SidebarContent>
        {mainGroups.map((group) => (
          <NavGroupSection key={group.id} group={group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="px-2 pb-3">
        {footerGroups.map((group) => (
          <NavGroupSection key={group.id} group={group} variant="footer" />
        ))}
        <UserBlock />
      </SidebarFooter>
      <SidebarRail />
      <CollapseToggle />
    </Sidebar>
  )
}

function CollapseToggle(): ReactElement {
  const { t } = useTranslation('shell')
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'
  const Icon = collapsed ? ChevronRight : ChevronLeft
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}
      className={cn(
        'absolute top-1/2 -right-3 z-20 grid size-6 -translate-y-1/2 place-items-center rounded-full',
        'border border-border bg-background text-muted-foreground shadow-sm',
        'transition-colors hover:text-foreground hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  )
}

function BrandBlock(): ReactElement {
  const { t } = useTranslation('shell')
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  return (
    <div className={cn('flex items-center gap-2', collapsed ? 'justify-center' : 'px-1')}>
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-md [background-image:var(--gradient-active)] text-sm font-semibold text-white shadow-sm"
      >
        Z
      </span>
      {!collapsed && (
        <span className="truncate text-sm font-semibold text-foreground">{t('brand.name')}</span>
      )}
    </div>
  )
}

type NavGroupSectionProps = {
  group: NavGroup
  variant?: 'main' | 'footer'
}

function NavGroupSection({ group, variant = 'main' }: NavGroupSectionProps): ReactElement {
  if (group.collapsible && group.labelKey) {
    return <CollapsibleNavGroup group={group} />
  }
  return (
    <SidebarGroup
      className={variant === 'footer' ? 'py-1 group-data-[collapsible=icon]:px-0' : undefined}
    >
      <SidebarGroupContent>
        <NavMenuList items={group.items} />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function CollapsibleNavGroup({ group }: { group: NavGroup }): ReactElement {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const label = group.labelKey ? t(group.labelKey) : ''

  return (
    <SidebarGroup>
      <SidebarGroupLabel asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`nav-group-${group.id}`}
          className="flex w-full items-center justify-between gap-2 hover:text-sidebar-foreground"
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-200',
              open ? '' : '-rotate-90',
            )}
          />
        </button>
      </SidebarGroupLabel>
      {open && (
        <SidebarGroupContent id={`nav-group-${group.id}`}>
          <NavMenuList items={group.items} />
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

function NavMenuList({ items }: { items: readonly NavItem[] }): ReactElement {
  const { t } = useTranslation()
  const { location } = useRouterState()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon
        const label = t(item.labelKey)
        const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={label}
              className={cn(
                'data-[active=true]:[background-image:var(--gradient-active)]',
                'data-[active=true]:text-white',
                'data-[active=true]:hover:[background-image:var(--gradient-active)]',
                'data-[active=true]:hover:text-white',
                'data-[active=true]:shadow-sm',
              )}
            >
              <Link to={item.to} aria-current={active ? 'page' : undefined}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function UserBlock(): ReactElement {
  const { t } = useTranslation(['shell', 'auth'])
  const { data: session } = useSession()
  const logout = useLogout()
  const selectRole = useSelectRole()
  const { data: sessionRoles } = useSessionRoles()
  const displayName = session?.display_name ?? session?.email ?? '—'
  const role = session?.role_slug ?? t('shell:user.roleFallback')
  // multi-role humans can re-bind the session without re-login (REQ-NON-3)
  const switchableRoles = (sessionRoles ?? []).filter((r) => r.user_id !== session?.id)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={displayName}
              className="glass-strong data-[state=open]:bg-sidebar-accent"
            >
              <Avatar size="sm">
                <AvatarFallback className="[background-image:var(--gradient-active)] text-xs font-medium text-white">
                  {initials(session?.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-[11px] text-muted-foreground">{role}</span>
              </div>
              <ChevronsUpDown aria-hidden="true" className="ml-auto opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="min-w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {displayName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild disabled={!session?.id}>
              {session?.role_slug === 'admin' ? (
                <Link
                  to="/admin/users/$userId"
                  params={{ userId: session?.id ?? '' }}
                  aria-disabled={!session?.id}
                >
                  <User aria-hidden="true" className="size-4" />
                  {t('shell:user.profile')}
                </Link>
              ) : (
                <Link
                  to="/users/$user_id"
                  params={{ user_id: session?.id ?? '' }}
                  aria-disabled={!session?.id}
                >
                  <User aria-hidden="true" className="size-4" />
                  {t('shell:user.profile')}
                </Link>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings aria-hidden="true" className="size-4" />
              {t('shell:user.settings')}
            </DropdownMenuItem>
            {switchableRoles.length > 0 && <DropdownMenuSeparator />}
            {switchableRoles.map((target) => (
              <DropdownMenuItem
                key={target.user_id}
                onSelect={() => {
                  selectRole.mutate(target.user_id)
                }}
              >
                <User aria-hidden="true" className="size-4" />
                {t('auth:roleSwitch.label', {
                  role: t(`auth:rolePicker.roles.${target.role_slug}`, {
                    defaultValue: target.role_slug,
                  }),
                })}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                logout.mutate()
              }}
            >
              <LogOut aria-hidden="true" className="size-4" />
              {t('auth:logout.label')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
