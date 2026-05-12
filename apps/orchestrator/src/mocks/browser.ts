import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

export async function startMockWorker(): Promise<void> {
  if (import.meta.env.VITE_API_MODE !== 'mock') return
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}
