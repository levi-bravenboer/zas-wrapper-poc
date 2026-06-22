import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { Task } from '../types'

import { PatientTasksPanel } from './PatientTasksPanel'

const { usePatientTasksQueryMock } = vi.hoisted(() => ({
  usePatientTasksQueryMock: vi.fn(),
}))

vi.mock('../hooks', () => ({
  usePatientTasksQuery: usePatientTasksQueryMock,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
    const { to, params, ...rest } = props
    const taskId = (params as { taskId?: string } | undefined)?.taskId
    return (
      <a href="#" data-to={String(to)} data-task-id={taskId} {...(rest as object)}>
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

function makeTask(id: string, title: string, daysFromNow = 1): Task {
  return {
    id,
    assignee_user_id: `u-${id}`,
    title,
    description: null,
    status: 'open',
    due_at: isoAt(daysFromNow),
    patient_id: 'p-1',
    source_ref: null,
    created_at: isoAt(0),
    updated_at: isoAt(0),
  }
}

function page(items: Task[]) {
  return { data: { items, page: 1, page_size: 50, total: items.length, total_pages: 1 } }
}

function wrap(ui: React.ReactElement): React.ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
}

describe('PatientTasksPanel', () => {
  beforeEach(() => {
    usePatientTasksQueryMock.mockReset()
  })

  it('renders nothing while loading', () => {
    usePatientTasksQueryMock.mockReturnValue({ data: undefined })
    const { container } = render(wrap(<PatientTasksPanel patientId="p-1" />))

    expect(screen.queryByTestId('patient-tasks-panel')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there are no open tasks', () => {
    usePatientTasksQueryMock.mockReturnValue(page([]))
    render(wrap(<PatientTasksPanel patientId="p-1" />))

    expect(screen.queryByTestId('patient-tasks-panel')).not.toBeInTheDocument()
  })

  it('renders one card per open task with its title and the count', () => {
    usePatientTasksQueryMock.mockReturnValue(
      page([makeTask('t-1', 'Bel patiënt'), makeTask('t-2', 'Labresultaten beoordelen')]),
    )
    render(wrap(<PatientTasksPanel patientId="p-1" />))

    expect(screen.getByTestId('patient-tasks-panel')).toBeInTheDocument()
    expect(screen.getByText('Bel patiënt')).toBeInTheDocument()
    expect(screen.getByText('Labresultaten beoordelen')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('links each card to the existing full task detail', () => {
    usePatientTasksQueryMock.mockReturnValue(page([makeTask('t-1', 'Bel patiënt')]))
    render(wrap(<PatientTasksPanel patientId="p-1" />))

    const link = screen.getByRole('link', { name: /Bel patiënt/ })
    expect(link).toHaveAttribute('data-to', '/tasks/$taskId')
    expect(link).toHaveAttribute('data-task-id', 't-1')
  })
})
