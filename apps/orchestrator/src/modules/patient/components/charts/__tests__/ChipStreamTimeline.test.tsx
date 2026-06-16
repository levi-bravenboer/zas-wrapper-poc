import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChipStreamTimeline } from '../ChipStreamTimeline'
import type { CategoricalSeries } from '../types'

function makeSeries(): CategoricalSeries {
  return {
    series_id: 'abc123def456',
    instrument_id: 'inst-q',
    instrument_name: 'Klachten dagboek',
    item_id: 'item-symptoms',
    label: 'Klachten',
    archetype: 'categorical',
    points: [
      {
        observed_at: '2026-06-10T20:00:00Z',
        archetype: 'categorical',
        responses: ['Vermoeidheid'],
      },
      {
        observed_at: '2026-06-13T20:00:00Z',
        archetype: 'categorical',
        responses: ['Vermoeidheid', 'Kortademigheid'],
      },
    ],
  }
}

describe('ChipStreamTimeline', () => {
  it('renders one row per point with response chips', () => {
    render(<ChipStreamTimeline series={makeSeries()} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(screen.getAllByText(/Vermoeidheid/i)).toHaveLength(2)
    expect(screen.getByText(/Kortademigheid/)).toBeInTheDocument()
  })

  it('renders newest entry first', () => {
    render(<ChipStreamTimeline series={makeSeries()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]?.textContent).toContain('Kortademigheid')
    expect(items[1]?.textContent).not.toContain('Kortademigheid')
  })

  it('renders a dash when a point has empty responses', () => {
    const series: CategoricalSeries = {
      ...makeSeries(),
      points: [
        {
          observed_at: '2026-06-10T20:00:00Z',
          archetype: 'categorical',
          responses: [],
        },
      ],
    }
    render(<ChipStreamTimeline series={series} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
