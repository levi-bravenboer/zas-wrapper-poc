import { Outlet } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { SmartProvider } from '@/platform/smart/SmartProvider'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

export function EmbedShell(): ReactElement {
  return (
    <SurfaceProvider surface={SURFACES.embed}>
      <SmartProvider>
        <main data-embed="hix" className="min-h-screen bg-background text-foreground">
          <Outlet />
        </main>
      </SmartProvider>
    </SurfaceProvider>
  )
}
