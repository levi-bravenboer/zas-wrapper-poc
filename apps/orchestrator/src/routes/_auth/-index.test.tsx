import { describe, expect, it } from 'vitest'

import { authIndexBeforeLoad } from './index'

describe('/_auth/ root index', () => {
  it('throws a redirect to /dashboard', async () => {
    await expect(
      Promise.resolve().then(() => authIndexBeforeLoad()),
    ).rejects.toMatchObject({ options: { to: '/dashboard' } })
  })
})
