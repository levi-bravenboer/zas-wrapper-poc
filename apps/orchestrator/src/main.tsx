import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Providers } from '@/app/providers'
import '@/styles/globals.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found in index.html')
}

async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_API_MODE === 'mock') {
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
