import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { TaskList } from './TaskList'
import type { TaskItem } from '../types'

const { useTasksQueryMock, useParamsMock } = vi.hoisted(() => ({
  useTasksQueryMock: vi.fn(),
  useParamsMock: vi.fn(),
}))

vi.mock('../hooks', () => ({
  useTasksQuery: useTasksQueryMock,
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
  family = 'Janssens',
  opened = false,
): TaskItem {
  return {
    id,
    source: 'appointment',
    source_id: id,
    due_at: isoAt(daysFromNow),
    title: 'Afspraak',
    kind: 'consultation',
    priority: null,
    opened,
    payload: {
      id,
      patient: {
        id: `p-${id}`,
        family_name: family,
        given_name: 'Anke',
        insz: null,
        primary_organisation_id: 'org-1',
      },
      starts_at: isoAt(daysFromNow),
      ends_at: isoAt(daysFromNow, 11),
      kind: 'consultation',
      modality: 'online',
      location_text: null,
      status: 'booked',
      participants: [],
    },
    // reason: TS widens the `'consultation'` / `'online'` / `'booked'`
    // string literals to `string` in the object-literal context, so the
    // merged shape does not narrow back to the OpenAPI enum unions on
    // `TaskItem.kind` / `payload.modality` / `payload.status`.
  } as TaskItem
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
    expect(screen.getByText('Nieuwe taken verschijnen automatisch')).toBeInTheDocument()
  })

  it('renders one row per TaskItem with no pager chrome', () => {
    useTasksQueryMock.mockReturnValue({
      data: [makeTask('t-1', 0), makeTask('t-2', 0, 'Bakker')],
      isLoading: false,
      isError: false,
    })
    render(wrap(<TaskList />))

    expect(screen.getByText(/Janssens, Anke/)).toBeInTheDocument()
    expect(screen.getByText(/Bakker, Anke/)).toBeInTheDocument()
    expect(screen.queryByText(/Meer laden/i)).toBeNull()
    expect(screen.queryByText(/Vorige|Volgende|Per pagina/i)).toBeNull()
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
    // third header is a formatted day label, not a relative word
    expect(headers[2]).not.toHaveTextContent(/Vandaag|Morgen/)
  })

  it('marks the row matching the $taskId URL param active', () => {
    useParamsMock.mockReturnValue({ taskId: 't-2' })
    useTasksQueryMock.mockReturnValue({
      data: [makeTask('t-1', 0), makeTask('t-2', 0, 'Bakker')],
      isLoading: false,
      isError: false,
    })
    render(wrap(<TaskList />))

    const active = screen.getByRole('link', { name: /Bakker, Anke/ })
    const inactive = screen.getByRole('link', { name: /Janssens, Anke/ })
    expect(active).toHaveAttribute('data-active', 'true')
    expect(inactive).not.toHaveAttribute('data-active')
  })
})
