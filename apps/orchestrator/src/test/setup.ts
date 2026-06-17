import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { server } from '@/mocks/server'

// Default findBy/waitFor timeout is 1000ms — too tight for router + query
// first-paint when many test files run in parallel and starve the worker
// (manifests as an empty render at the deadline). 5s absorbs the contention.
configure({ asyncUtilTimeout: 5000 })

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
