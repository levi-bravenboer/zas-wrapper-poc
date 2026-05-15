import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ChevronsUpDown, LogOut, Settings, User } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/style/cn'
import { useLogout, useSession } from '@/modules/auth/hooks'
import { getFeaturesForSurface } from '@/platform/embed/defineFeature'

import { hardWiredNavItems, type NavItem } from './navItems'

function useResolvedNavItems(): readonly NavItem[] {
  return useMemo(() => {
    const featureItems = getFeaturesForSurface('app').flatMap<NavItem>((feature) =>
      feature.nav
        ? [
            {
              to: feature.path,
              labelKey: feature.titleKey,
              icon: feature.nav.icon,
              order: feature.nav.order ?? 100,
            },
          ]
        : [],
    )
    return [...hardWiredNavItems, ...featureItems].toSorted((a, b) => a.order - b.order)
  }, [])
}

export function AppSidebar(): ReactElement {
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
        <SidebarGroup>
          <SidebarGroupContent>
            <NavMenu />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2 pb-3">
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

function NavMenu(): ReactElement {
  const { t } = useTranslation('nav')
  const items = useResolvedNavItems()
  const { location } = useRouterState()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon
        const label = t(item.labelKey.replace(/^nav\./, ''))
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

function initialsFromName(name: string | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return '??'
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '??'
}

function UserBlock(): ReactElement {
  const { t } = useTranslation(['shell', 'auth'])
  const { data: session } = useSession()
  const logout = useLogout()
  const displayName = session?.displayName ?? session?.email ?? '—'
  const role = session?.roles[0] ?? t('shell:user.roleFallback')

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
                  {initialsFromName(session?.displayName)}
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
            <DropdownMenuItem disabled>
              <User aria-hidden="true" className="size-4" />
              {t('shell:user.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings aria-hidden="true" className="size-4" />
              {t('shell:user.settings')}
            </DropdownMenuItem>
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
