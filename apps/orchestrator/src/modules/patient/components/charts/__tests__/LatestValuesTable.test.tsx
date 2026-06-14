import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { LatestValuesTable } from '../LatestValuesTable'
import type { LusciiMeasurementSeries } from '../types'

const SYS: LusciiMeasurementSeries = {
  series_id: 'sys',
  instrument_id: 'inst-bp',
  instrument_name: 'Bloeddruk',
  item_id: 'item-sys',
  label: 'Systolisch',
  archetype: 'numeric',
  unit: 'mmHg',
  points: [
    { observed_at: '2026-06-10T08:00:00Z', archetype: 'numeric', value: 130 },
    { observed_at: '2026-06-13T08:00:00Z', archetype: 'numeric', value: 128 },
  ],
}

const WEIGHT: LusciiMeasurementSeries = {
  series_id: 'w',
  instrument_id: 'inst-w',
  instrument_name: 'Gewicht',
  item_id: 'item-w',
  label: 'Gewicht',
  archetype: 'numeric',
  unit: 'kg',
  points: [
    { observed_at: '2026-06-14T08:00:00Z', archetype: 'numeric', value: 79.2 },
  ],
}

const QUEST: LusciiMeasurementSeries = {
  series_id: 'q',
  instrument_id: 'inst-q',
  instrument_name: 'Klachten dagboek',
  item_id: 'item-symptoms',
  label: 'Klachten',
  archetype: 'categorical',
  points: [
    {
      observed_at: '2026-06-12T20:00:00Z',
      archetype: 'categorical',
      responses: ['Vermoeidheid', 'Kortademigheid'],
    },
  ],
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('LatestValuesTable', () => {
  it('renders one row per series with formatted value', () => {
    renderWithI18n(<LatestValuesTable series={[SYS, WEIGHT, QUEST]} />)
    expect(screen.getByText('Systolisch')).toBeInTheDocument()
    expect(screen.getByText('128 mmHg')).toBeInTheDocument()
    expect(screen.getByText('Gewicht')).toBeInTheDocument()
    expect(screen.getByText('79,2 kg')).toBeInTheDocument()
    expect(screen.getByText('Vermoeidheid, Kortademigheid')).toBeInTheDocument()
  })

  it('sorts rows by most-recent observed_at DESC', () => {
    renderWithI18n(<LatestValuesTable series={[SYS, WEIGHT, QUEST]} />)
    const rows = screen.getAllByRole('row')
    expect(rows[0]?.textContent).toContain('Gewicht') // 2026-06-14 newest
    expect(rows[1]?.textContent).toContain('Systolisch') // 2026-06-13
    expect(rows[2]?.textContent).toContain('Klachten') // 2026-06-12
  })

  it('renders nothing for an empty series array', () => {
    renderWithI18n(<LatestValuesTable series={[]} />)
    expect(screen.queryByRole('table')).toBeNull()
  })
})
