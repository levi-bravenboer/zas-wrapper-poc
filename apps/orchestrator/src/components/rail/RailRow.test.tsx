import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RailRow } from './RailRow'

describe('RailRow', () => {
  it('renders primary, secondary and trailing slots', () => {
    render(
      <RailRow
        leading={<span data-testid="lead">L</span>}
        primary="Jansen, Marie"
        secondary="Morgen 09:00"
        trailing={<span data-testid="trail">T</span>}
      />,
    )

    expect(screen.getByText('Jansen, Marie')).toBeInTheDocument()
    expect(screen.getByText('Morgen 09:00')).toBeInTheDocument()
    expect(screen.getByTestId('lead')).toBeInTheDocument()
    expect(screen.getByTestId('trail')).toBeInTheDocument()
  })

  it('applies selected styling via the data-active marker and accent classes', () => {
    render(<RailRow primary="Geselecteerd" selected />)

    const row = screen.getByRole('button', { name: /geselecteerd/i })
    expect(row).toHaveAttribute('data-active', 'true')
    expect(row.className).toContain('before:bg-primary')
  })

  it('lets the caller own the link element via render, passing content + className', () => {
    render(
      <RailRow
        primary="Via link"
        selected
        render={({ content, className }) => (
          <a href="/x" className={className} data-testid="row-link">
            {content}
          </a>
        )}
      />,
    )

    const link = screen.getByTestId('row-link')
    expect(link).toHaveTextContent('Via link')
    expect(link.className).toContain('before:bg-primary')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
