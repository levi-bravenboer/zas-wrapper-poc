import '@/modules'

import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Providers } from '@/app/providers'
import { env } from '@/config/env'
import { getFeatures } from '@/platform/embed/defineFeature'
import '@/styles/globals.css'

if (env.PROD && getFeatures().length === 0) {
  throw new Error(
    'Feature registry is empty at boot — ensure each feature module is re-exported from @/modules.',
  )
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found in index.html')
}

async function bootstrap(): Promise<void> {
  if (env.API_MODE === 'mock') {
    const { startMockWorker } = await import('@/mocks/browser')
    await startMockWorker()
  }
  createRoot(container!).render(
    <StrictMode>
      <Providers />
    </StrictMode>,
  )
}

void bootstrap()
