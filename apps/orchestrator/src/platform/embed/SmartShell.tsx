import type { ReactElement } from 'react'

import { MenuLayout } from '@/components/layout/MenuLayout'
import { SmartProvider } from '@/platform/smart/SmartProvider'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

export function SmartShell(): ReactElement {
  return (
    <SurfaceProvider surface={SURFACES.smart}>
      <SmartProvider>
        <MenuLayout />
      </SmartProvider>
    </SurfaceProvider>
  )
}
