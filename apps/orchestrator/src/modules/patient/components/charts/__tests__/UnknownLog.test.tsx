import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { UnknownSeries } from '../types'
import { UnknownLog } from '../UnknownLog'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

const SERIES: UnknownSeries = {
  series_id: 'sid',
  instrument_id: 'inst-n',
  instrument_name: 'NYHA klasse',
  item_id: 'item-nyha',
  label: 'NYHA',
  archetype: 'unknown',
  points: [
    { observed_at: '2026-06-10T08:00:00Z', archetype: 'unknown', raw: 'II' },
    { observed_at: '2026-06-13T08:00:00Z', archetype: 'unknown', raw: 'III' },
  ],
}

describe('UnknownLog', () => {
  it('renders the raw value + an "Onbekend formaat" annotation per row', () => {
    renderWithI18n(<UnknownLog series={SERIES} />)
    expect(screen.getByText('II')).toBeInTheDocument()
    expect(screen.getByText('III')).toBeInTheDocument()
    expect(screen.getAllByText(/onbekend formaat/i)).toHaveLength(2)
  })

  it('renders a dash for a null raw value', () => {
    renderWithI18n(
      <UnknownLog
        series={{
          ...SERIES,
          points: [{ observed_at: '2026-06-13T08:00:00Z', archetype: 'unknown', raw: null }],
        }}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
