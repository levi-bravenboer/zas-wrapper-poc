import { setupWorker } from 'msw/browser'

import { env } from '@/config/env'

import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

export async function startMockWorker(): Promise<void> {
  if (env.API_MODE !== 'mock') return
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}
