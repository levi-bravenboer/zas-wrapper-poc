/* eslint-disable i18next/no-literal-string -- inline test fixtures, not user copy. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { Route as TaskDetailRoute } from './$taskId/index'
import { Route as TasksIndexRoute } from './index'

const { useTaskQueryMock, useTasksQueryMock, useSetTaskStatusMock } = vi.hoisted(() => ({
  useTaskQueryMock: vi.fn(),
  useTasksQueryMock: vi.fn(),
  useSetTaskStatusMock: vi.fn(),
}))

vi.mock('@/modules/tasks/hooks', () => ({
  useTaskQuery: useTaskQueryMock,
  useTasksQuery: useTasksQueryMock,
  useSetTaskStatus: useSetTaskStatusMock,
}))

// Stub the shared collaboration panels: they pull in the real app router via
// `useSession`, which conflicts with the test's memory router.
vi.mock('@/modules/collaboration/components', () => ({
  NotesPanel: () => null,
  AttachmentsPanel: () => null,
}))

const TASK = {
  id: 't-1',
  assignee_user_id: 'u-1',
  title: 'Controle bloeddruk',
  description: 'Bel de patiënt voor opvolging.',
  status: 'open' as const,
  due_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  patient_id: 'p-1',
  source_ref: null,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
}

function mountAt(initialPath: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )

  const rootRoute = createRootRoute()
  const IndexComponent = TasksIndexRoute.options.component
  const DetailComponent = TaskDetailRoute.options.component
  if (!IndexComponent || !DetailComponent) throw new Error('route component missing')

  const tasksIndex = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => (
      <Wrap>
        <IndexComponent />
      </Wrap>
    ),
  })
  const taskDetail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => (
      <Wrap>
        <DetailComponent />
      </Wrap>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([tasksIndex, taskDetail]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('/_auth/tasks routes', () => {
  beforeEach(() => {
    useTaskQueryMock.mockReset()
    useTasksQueryMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    useSetTaskStatusMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('index renders the selection empty state', async () => {
    mountAt('/tasks')
    expect(await screen.findByText('Selecteer een taak')).toBeInTheDocument()
  })

  it('detail renders the task title, description and a complete action', async () => {
    useTaskQueryMock.mockReturnValue({
      data: TASK,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mountAt('/tasks/t-1')

    expect(await screen.findByRole('heading', { name: /Controle bloeddruk/ })).toBeInTheDocument()
    expect(screen.getByText('Bel de patiënt voor opvolging.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /afgerond/i })).toBeInTheDocument()
  })

  it('detail renders not-found for a 404 task', async () => {
    useTaskQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: Object.assign(new Error('not found'), { status: 404, name: 'ApiError' }),
      refetch: vi.fn(),
    })
    mountAt('/tasks/missing')
    expect(await screen.findByText(/Niet gevonden/i)).toBeInTheDocument()
  })
})
