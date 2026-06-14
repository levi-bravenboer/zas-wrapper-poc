import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Sparkline } from '../Sparkline'
import type { LusciiNumericPoint } from '../types'

function numericPoint(observed_at: string, value: number): LusciiNumericPoint {
  return { observed_at, archetype: 'numeric', value }
}

describe('Sparkline', () => {
  it('renders the sparkline SVG when there are at least 2 points', () => {
    render(
      <Sparkline
        points={[
          numericPoint('2026-06-01T08:00:00Z', 80),
          numericPoint('2026-06-02T08:00:00Z', 82),
          numericPoint('2026-06-03T08:00:00Z', 79),
        ]}
      />,
    )
    expect(screen.getByTestId('sparkline')).toBeInTheDocument()
  })

  it('renders nothing for a single-point series', () => {
    render(<Sparkline points={[numericPoint('2026-06-01T08:00:00Z', 80)]} />)
    expect(screen.queryByTestId('sparkline')).toBeNull()
  })

  it('renders nothing for an empty series', () => {
    render(<Sparkline points={[]} />)
    expect(screen.queryByTestId('sparkline')).toBeNull()
  })
})
