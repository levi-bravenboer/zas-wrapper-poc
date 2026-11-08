import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { Task } from '../types'

import { TaskList } from './TaskList'

const { useTasksQueryMock, useParamsMock } = vi.hoisted(() => ({
  useTasksQueryMock: vi.fn(),
  useParamsMock: vi.fn(),
}))

vi.mock('../hooks', () => ({
  useTasksQuery: useTasksQueryMock,
}))

vi.mock('@/modules/patient/hooks', () => ({
  usePatient: () => ({ data: undefined }),
}))

vi.mock('@tanstack/react-router', () => ({
  useParams: useParamsMock,
  Link: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
    const { to, params, ...rest } = props
    void to
    void params
    return (
      <a href="#" {...(rest as object)}>
        {children}
      </a>
    )
  },
}))

function isoAt(daysFromNow: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function makeTask(
  id: string,
  daysFromNow: number,
  title = 'Taak',
  status: Task['status'] = 'open',
): Task {
  return {
    id,
    assignee_user_id: `u-${id}`,
    title,
    description: null,
    status,
    due_at: isoAt(daysFromNow),
    patient_id: null,
    source_ref: null,
    created_at: isoAt(0),
    updated_at: isoAt(0),
  }
}

function wrap(ui: React.ReactElement): React.ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
}

describe('TaskList', () => {
  beforeEach(() => {
    useTasksQueryMock.mockReset()
    useParamsMock.mockReturnValue({})
  })

  it('renders skeleton rows while loading', () => {
    useTasksQueryMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(wrap(<TaskList />))

    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument()
  })

  it('renders the fixed empty-state copy when there are no tasks', () => {
    useTasksQueryMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(wrap(<TaskList />))

    expect(screen.getByText('Geen taken')).toBeInTheDocument()
  })

  it('renders one row per task showing the title', () => {
    useTasksQueryMock.mockReturnValue({
      data: [
        makeTask('t-1', 0, 'Bloeddruk controleren'),
        makeTask('t-2', 0, 'Labresultaat nakijken'),
      ],
      isLoading: false,
      isError: false,
    })
    render(wrap(<TaskList />))

    expect(screen.getByText('Bloeddruk controleren')).toBeInTheDocument()
    expect(screen.getByText('Labresultaat nakijken')).toBeInTheDocument()
  })

  it('groups rows under day headers (Vandaag / Morgen / day label)', () => {
    useTasksQueryMock.mockReturnValue({
      data: [makeTask('t-1', 0), makeTask('t-2', 1), makeTask('t-3', 5)],
      isLoading: false,
      isError: false,
    })
    render(wrap(<TaskList />))

    const headers = screen.getAllByRole('heading', { level: 2 })
    expect(headers).toHaveLength(3)
    expect(headers[0]).toHaveTextContent('Vandaag')
    expect(headers[1]).toHaveTextContent('Morgen')
    expect(headers[2]).not.toHaveTextContent(/Vandaag|Morgen/)
  })

  it('marks the row matching the $taskId URL param active', () => {
    useParamsMock.mockReturnValue({ taskId: 't-2' })
    useTasksQueryMock.mockReturnValue({
      data: [makeTask('t-1', 0, 'Eerste taak'), makeTask('t-2', 0, 'Tweede taak')],
      isLoading: false,
      isError: false,
    })
    render(wrap(<TaskList />))

    const active = screen.getByRole('link', { name: /Tweede taak/ })
    const inactive = screen.getByRole('link', { name: /Eerste taak/ })
    expect(active).toHaveAttribute('data-active', 'true')
    expect(inactive).not.toHaveAttribute('data-active')
  })
})
