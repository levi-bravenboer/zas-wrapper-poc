import type { ReactElement } from 'react'

import { MenuLayout } from '@/components/layout/MenuLayout'
import { api } from '@/lib/api/client'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

import { OrchestratorDepsProvider } from './deps'

export function AppShell(): ReactElement {
  return (
    <SurfaceProvider surface={SURFACES.app}>
      <OrchestratorDepsProvider deps={{ api }}>
        <MenuLayout />
      </OrchestratorDepsProvider>
    </SurfaceProvider>
  )
}
