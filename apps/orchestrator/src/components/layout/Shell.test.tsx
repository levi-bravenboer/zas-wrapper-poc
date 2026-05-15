import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   shadcn sidebar attribute selectors lack semantic Testing Library equivalents. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'
import { AppShell } from '@/platform/embed/AppShell'

const STORAGE_KEY = 'orchestrator.sidebar.collapsed'

function mountShellOnIndex(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({ component: AppShell })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    /* eslint-disable-next-line i18next/no-literal-string -- inline test fixture */
    component: () => <div data-testid="page-content">content</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('Shell (menu surface, integration via AppShell)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders the sidebar block on menu surface', async () => {
    const { container } = mountShellOnIndex()
    await screen.findByTestId('page-content')
    expect(container.querySelector('[data-slot="sidebar"]')).not.toBeNull()
  })

  it('persists the collapsed flag to localStorage when ⌘\\ toggles the sidebar', async () => {
    const user = userEvent.setup()
    mountShellOnIndex()
    await screen.findByTestId('page-content')

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false')

    await user.keyboard('{Meta>}\\{/Meta}')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true')

    await user.keyboard('{Meta>}\\{/Meta}')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false')
  })

  it('reads the persisted collapsed flag on mount', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    const { container } = mountShellOnIndex()
    await screen.findByTestId('page-content')
    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute('data-state')).toBe('collapsed')
  })
})
