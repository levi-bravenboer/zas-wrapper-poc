import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import { toast, toastError } from '@/lib/notifications/toast'

import { useEntityDelete } from '../useEntityDelete'

vi.mock('@/lib/notifications/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  toastError: vi.fn(),
}))

function setup(mutate: () => Promise<void>) {
  let hookResult: ReturnType<typeof useEntityDelete> | undefined

  function Root() {
    hookResult = useEntityDelete({
      entityName: 'Iets',
      listPath: { to: '/login' },
      mutate,
      successMessage: 'verwijderd',
    })
    return (
      <>
        <button type="button" onClick={hookResult.open}>
          open
        </button>
        {hookResult.dialog}
      </>
    )
  }

  const rootRoute = createRootRoute({ component: Root })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <div data-testid="list">list</div>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div data-testid="index">index</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, listRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router as unknown as AnyRouter} />
    </I18nextProvider>,
  )
  return { router, getResult: () => hookResult }
}

describe('useEntityDelete', () => {
  it('confirm runs mutation, fires success toast, navigates to listPath', async () => {
    vi.mocked(toast.success).mockClear()
    const user = userEvent.setup()
    const mutate = vi.fn(async () => {})
    const { router } = setup(mutate)
    const openBtn = await screen.findByRole('button', { name: 'open' })
    await user.click(openBtn)
    const confirmBtn = await screen.findByRole('button', { name: /^verwijderen$/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalledWith('verwijderd')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('keeps dialog open on failure and fires error toast', async () => {
    vi.mocked(toastError).mockClear()
    const user = userEvent.setup()
    const mutate = vi.fn(async () => {
      throw new Error('boom')
    })
    const { router, getResult } = setup(mutate)
    await screen.findByRole('button', { name: 'open' })
    await act(async () => {
      getResult()?.open()
    })
    const confirmBtn = await screen.findByRole('button', { name: /^verwijderen$/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(router.state.location.pathname).toBe('/')
    expect(getResult()?.isOpen).toBe(true)
  })
})
