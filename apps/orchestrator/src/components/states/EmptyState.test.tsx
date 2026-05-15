import { render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title heading wrapped in a status region', () => {
    render(<EmptyState title="Nog geen patiënten" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Nog geen patiënten', level: 3 }),
    ).toBeInTheDocument()
  })

  it('renders body + icon + action when provided', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Geen taken"
        body="Alle taken zijn afgehandeld."
        // eslint-disable-next-line i18next/no-literal-string -- inline test fixture
        action={<button type="button">Nieuwe taak</button>}
      />,
    )
    expect(screen.getByText('Alle taken zijn afgehandeld.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nieuwe taak' })).toBeInTheDocument()
  })
})
