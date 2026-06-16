import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { TaskItem } from '../types'

import { AppointmentContextBlock } from './AppointmentContextBlock'

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  const futureIso = new Date(Date.now() + 60 * 60_000).toISOString()
  return {
    id: '11111111-1111-4111-8111-111111111111',
    source: 'appointment',
    source_id: '11111111-1111-4111-8111-111111111111',
    due_at: futureIso,
    title: 'Controle bloeddruk',
    kind: 'consultation',
    priority: null,
    opened: false,
    payload: {
      id: '11111111-1111-4111-8111-111111111111',
      patient: {
        id: 'pp-1',
        family_name: 'Janssens',
        given_name: 'Anke',
        insz: '85.03.12-072.47',
        primary_organisation_id: 'org-1',
      },
      starts_at: futureIso,
      ends_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
      kind: 'consultation',
      modality: 'on_site',
      location_text: 'Polikliniek 1, kamer 4',
      status: 'booked',
      participants: [{ user_id: 'u-1', role: 'lead', user_display_name: 'Dr. Janssen' }],
    },
    ...overrides,
    // reason: spread of `Partial<TaskItem>` widens literal-typed enum fields
    // (`kind`, `modality`, `status`) so TS cannot prove the merge yields a
    // full `TaskItem`. Test-only fixture; field-by-field copy would be noise.
  } as TaskItem
}

function wrap(ui: React.ReactElement): React.ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
}

describe('AppointmentContextBlock', () => {
  it('renders the task title + kind badge + location', () => {
    render(wrap(<AppointmentContextBlock task={makeTask()} />))
    expect(screen.getByText('Controle bloeddruk')).toBeInTheDocument()
    expect(screen.getByText('Consultatie')).toBeInTheDocument()
    expect(screen.getByText(/Polikliniek 1/)).toBeInTheDocument()
  })

  it('renders the lead participant name when present', () => {
    render(wrap(<AppointmentContextBlock task={makeTask()} />))
    expect(screen.getByText(/Lead Dr\. Janssen/)).toBeInTheDocument()
  })

  it('omits the lead line when there is no lead participant', () => {
    const task = makeTask({
      payload: {
        ...makeTask().payload,
        participants: [{ user_id: 'u-2', role: 'support', user_display_name: 'Verp. Smets' }],
      },
    })
    render(wrap(<AppointmentContextBlock task={task} />))
    expect(screen.queryByText(/Lead /)).toBeNull()
  })

  it('renders the Open afspraak action', () => {
    render(wrap(<AppointmentContextBlock task={makeTask()} />))
    expect(screen.getByRole('button', { name: /open afspraak/i })).toBeInTheDocument()
  })
})
