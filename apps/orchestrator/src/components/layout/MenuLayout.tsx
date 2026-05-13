import { Outlet } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { Sidebar } from './Sidebar'

export function MenuLayout(): ReactElement {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
