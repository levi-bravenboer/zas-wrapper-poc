import type { ReactElement } from 'react'

import { Shell } from '@/components/layout/Shell'
import { EmbedHostBridge } from '@/platform/embed/EmbedHostBridge'
import { SmartProvider } from '@/platform/smart/SmartProvider'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

export function EmbedShell(): ReactElement {
  return (
    <SurfaceProvider surface={SURFACES.embed}>
      <SmartProvider>
        <EmbedHostBridge>
          <Shell />
        </EmbedHostBridge>
      </SmartProvider>
    </SurfaceProvider>
  )
}
