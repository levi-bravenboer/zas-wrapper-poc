import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { orchestratorTasksPort } from '../adapters/orchestrator'
import { tasksPort } from '../ports'
import { TasksPage } from '../TasksPage'

function renderTasksPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const port = orchestratorTasksPort({ api: null })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <tasksPort.Provider value={port}>
          <TasksPage />
        </tasksPort.Provider>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('TasksPage', () => {
  it('renders the page heading from the nav.tasks i18n key', async () => {
    renderTasksPage()
    expect(await screen.findByRole('heading', { name: 'Taken' })).toBeInTheDocument()
  })

  it('renders one list item per task returned from the orchestrator port', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByTestId('tasks-list')).toBeInTheDocument()
    })
    expect(screen.getByTestId('task-t-1')).toHaveTextContent('Review Patient X intake')
    expect(screen.getByTestId('task-t-2')).toHaveTextContent('Sign off pathway adjustment')
    expect(screen.getByTestId('task-t-3')).toHaveTextContent('Schedule follow-up call')
  })

  it('throws when rendered without a tasksPort provider', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    expect(() =>
      render(
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <TasksPage />
          </QueryClientProvider>
        </I18nextProvider>,
      ),
    ).toThrow('Tasks port missing')
  })
})
