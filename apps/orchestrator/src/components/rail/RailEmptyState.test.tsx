import { render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { RailEmptyState, RailSelectionEmptyState } from './RailEmptyState'

describe('RailEmptyState', () => {
  it('renders title heading, body and icon', () => {
    render(
      <RailEmptyState
        icon={<Inbox aria-hidden className="size-6" />}
        title="Geen items"
        body="Er zijn geen items om te tonen."
      />,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Geen items', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Er zijn geen items om te tonen.')).toBeInTheDocument()
  })

  it('renders the selection variant title and body', () => {
    render(<RailSelectionEmptyState title="Selecteer een item" body="Kies links een item." />)

    expect(
      screen.getByRole('heading', { name: 'Selecteer een item', level: 3 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Kies links een item.')).toBeInTheDocument()
  })
})
