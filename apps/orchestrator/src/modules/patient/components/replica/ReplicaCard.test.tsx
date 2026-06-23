import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import type {
  CategoricalSeries,
  FreeTextSeries,
  LusciiMeasurementSeries,
  NumericSeries,
} from '../charts/types'

import { ReplicaCard } from './ReplicaCard'

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

const numeric: NumericSeries = {
  series_id: 'num',
  instrument_id: 'inst-weight',
  instrument_name: 'Gewicht',
  item_id: 'weight',
  label: 'Gewicht',
  archetype: 'numeric',
  unit: 'kg',
  points: [
    { observed_at: '2026-06-10T08:00:00Z', archetype: 'numeric', value: 80 },
    { observed_at: '2026-06-12T08:00:00Z', archetype: 'numeric', value: 82 },
  ],
}

const categorical: CategoricalSeries = {
  series_id: 'cat',
  instrument_id: 'inst-q',
  instrument_name: 'Klachten',
  item_id: 'symptoms',
  label: 'Klachten',
  archetype: 'categorical',
  points: [
    {
      observed_at: '2026-06-10T20:00:00Z',
      archetype: 'categorical',
      responses: ['Vermoeidheid'],
      alert_flag: 'red',
    },
  ],
}

const freeText: FreeTextSeries = {
  series_id: 'ft',
  instrument_id: 'inst-note',
  instrument_name: 'Notitie',
  item_id: 'note',
  label: 'Notitie',
  archetype: 'free_text',
  points: [{ observed_at: '2026-06-10T20:00:00Z', archetype: 'free_text', text: 'Voelt me ok.' }],
}

describe('ReplicaCard', () => {
  it('renders the underlined title and stat row for a numeric series', () => {
    renderWithI18n(<ReplicaCard title="Gewicht" series={[numeric]} />)
    expect(screen.getByRole('heading', { name: 'Gewicht' })).toBeInTheDocument()
    expect(screen.getByText('Gemiddeld')).toBeInTheDocument()
  })

  it('dispatches a categorical series to the chip-stream renderer', () => {
    renderWithI18n(<ReplicaCard title="Klachten" series={[categorical]} />)
    expect(screen.getByTestId('chip-stream')).toBeInTheDocument()
  })

  it('dispatches a free-text series to the free-text log renderer', () => {
    renderWithI18n(<ReplicaCard title="Notitie" series={[freeText]} />)
    expect(screen.getByTestId('free-text-log')).toBeInTheDocument()
  })

  it('colours a flagged row via its alert dot', () => {
    renderWithI18n(<ReplicaCard title="Klachten" series={[categorical]} />)
    expect(screen.getByTestId('alert-dot')).toHaveAttribute('data-severity', 'critical')
  })

  it('omits the stat row for non-numeric series', () => {
    const series: LusciiMeasurementSeries[] = [categorical]
    renderWithI18n(<ReplicaCard title="Klachten" series={series} />)
    expect(screen.queryByText('Gemiddeld')).toBeNull()
  })
})
