import type { ReactElement } from 'react'

import { Shell } from '@/components/layout/Shell'
import { SmartProvider } from '@/platform/smart/SmartProvider'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

export function EmbedShell(): ReactElement {
  return (
    <SurfaceProvider surface={SURFACES.embed}>
      <SmartProvider>
        <Shell />
      </SmartProvider>
    </SurfaceProvider>
  )
}
