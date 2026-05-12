import { describe, expect, it } from 'vitest'

import { Route as IndexRoute } from './index'

describe('/_auth/ root index', () => {
  it('throws a redirect to /dashboard', async () => {
    const beforeLoad = IndexRoute.options.beforeLoad
    if (!beforeLoad) throw new Error('beforeLoad missing')

    await expect(
      Promise.resolve().then(() =>
        beforeLoad({} as NonNullable<Parameters<typeof beforeLoad>[0]>),
      ),
    ).rejects.toMatchObject({ options: { to: '/dashboard' } })
  })
})
