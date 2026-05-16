import {
  Link,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { useDirtyGuard } from '../useDirtyGuard'

function setup({ isDirty }: { isDirty: boolean }) {
  let hookResult: ReturnType<typeof useDirtyGuard> | undefined

  function Root() {
    hookResult = useDirtyGuard({ isDirty })
    return (
      <>
        <Link to="/login" data-testid="goto">
          go
        </Link>
        {hookResult.dialog}
      </>
    )
  }

  const rootRoute = createRootRoute({ component: Root })
  const nextRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <div data-testid="next">next</div>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div data-testid="index">index</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, nextRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router as unknown as AnyRouter} />
    </I18nextProvider>,
  )
  return { router, getResult: () => hookResult }
}

describe('useDirtyGuard', () => {
  it('opens dialog when dirty navigation is attempted', async () => {
    const { router } = setup({ isDirty: true })
    await screen.findByTestId('goto')
    act(() => {
      void router.navigate({ to: '/login' })
    })
    expect(await screen.findByText(/wijzigingen niet opgeslagen/i)).toBeTruthy()
  })

  it('allows navigation when not dirty', async () => {
    const { router } = setup({ isDirty: false })
    await act(async () => {
      await router.navigate({ to: '/login' })
    })
    expect(screen.queryByText(/wijzigingen niet opgeslagen/i)).toBeNull()
  })

  it('dismiss() lets the next navigation pass through', async () => {
    const { router, getResult } = setup({ isDirty: true })
    act(() => {
      getResult()?.dismiss()
    })
    await act(async () => {
      await router.navigate({ to: '/login' })
    })
    expect(screen.queryByText(/wijzigingen niet opgeslagen/i)).toBeNull()
  })
})
