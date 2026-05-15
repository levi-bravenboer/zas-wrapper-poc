import type { ReactElement } from 'react'

import { Shell } from '@/components/layout/Shell'
import { SmartProvider } from '@/platform/smart/SmartProvider'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

export function SmartShell(): ReactElement {
  return (
    <SurfaceProvider surface={SURFACES.smart}>
      <SmartProvider>
        <Shell />
      </SmartProvider>
    </SurfaceProvider>
  )
}
