import { Outlet } from '@tanstack/react-router'
import { useEffect, useState, type ReactElement } from 'react'

import {
  CommandPalette,
  CommandPaletteProvider,
  useRouteCommands,
} from '@/components/command-palette'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useSurface } from '@/platform/surface/hooks'

import { AppSidebar } from './AppSidebar'
import { RouteBreadcrumbs } from './RouteBreadcrumbs'

const STORAGE_KEY = 'orchestrator.sidebar.collapsed'

const persistedCollapsed = {
  read: (): boolean =>
    typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true',
  write: (collapsed: boolean): void => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, String(collapsed))
  },
}

export function Shell(): ReactElement {
  const surface = useSurface()

  if (surface.shell === 'bare') {
    return (
      <main data-shell="bare" data-surface={surface.id} className="min-h-screen">
        <Outlet />
      </main>
    )
  }

  return <MenuShell />
}

function MenuShell(): ReactElement {
  const [open, setOpen] = useState<boolean>(() => !persistedCollapsed.read())

  useEffect(() => {
    persistedCollapsed.write(!open)
  }, [open])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <CommandPaletteProvider>
        <AppSidebar />
        <SidebarInset data-shell="menu" className="h-svh min-h-0 overflow-hidden bg-transparent">
          <RouteCommandsRegistry />
          <CommandPalette />
          <RouteBreadcrumbs />
          <Outlet />
        </SidebarInset>
      </CommandPaletteProvider>
    </SidebarProvider>
  )
}

function RouteCommandsRegistry(): null {
  useRouteCommands()
  return null
}
