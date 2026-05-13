import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type Client from 'fhirclient/lib/Client'
import type { fhirclient } from 'fhirclient/lib/types'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'

import { i18n } from '@/lib/i18n'
import { useLaunchStore } from '@/modules/smart-launch/store'
import { tasksFeature } from '@/modules/tasks'
import { renderFeature } from '@/platform/embed/renderFeature'

export function seedSmartLaunchSession(): void {
  useLaunchStore.getState().setContext({
    iss: 'https://fhir.test',
    launch: 'launch-1',
    surface: 'smart',
    returnPath: null,
    client: { state: { tokenResponse: {} } } as unknown as Client,
    token: { access_token: 'tok', token_type: 'bearer' } as fhirclient.TokenResponse,
    ctx: { patient: { id: '123', reference: 'Patient/123' } },
  })
}

export function mountShellWithTasks(
  ShellComponent: () => ReactElement,
  initialPath: string,
): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({ component: ShellComponent })
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: renderFeature(tasksFeature),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([tasksRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}
