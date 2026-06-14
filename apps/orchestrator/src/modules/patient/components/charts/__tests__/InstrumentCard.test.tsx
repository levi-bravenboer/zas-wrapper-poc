import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { InstrumentCard } from '../InstrumentCard'
import type { NumericSeries, CategoricalSeries } from '../types'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

const SYS: NumericSeries = {
  series_id: 'sys',
  instrument_id: 'inst-bp',
  instrument_name: 'Bloeddruk',
  item_id: 'item-sys',
  label: 'Systolisch',
  archetype: 'numeric',
  unit: 'mmHg',
  points: [
    { observed_at: '2026-06-10T08:00:00Z', archetype: 'numeric', value: 130 },
    { observed_at: '2026-06-11T08:00:00Z', archetype: 'numeric', value: 128 },
    { observed_at: '2026-06-13T08:00:00Z', archetype: 'numeric', value: 132 },
  ],
}

const QUEST: CategoricalSeries = {
  series_id: 'q',
  instrument_id: 'inst-q',
  instrument_name: 'Klachten dagboek',
  item_id: 'item-symptoms',
  label: 'Klachten',
  archetype: 'categorical',
  points: [
    {
      observed_at: '2026-06-13T20:00:00Z',
      archetype: 'categorical',
      responses: ['Vermoeidheid'],
    },
  ],
}

describe('InstrumentCard', () => {
  it('renders the instrument name + last value in the header', () => {
    renderWithI18n(
      <InstrumentCard instrumentId="inst-bp" instrumentName="Bloeddruk" series={[SYS]} />,
    )
    expect(screen.getByText('Bloeddruk')).toBeInTheDocument()
    expect(screen.getByText(/132 mmHg/)).toBeInTheDocument()
  })

  it('falls back to "Onbekend instrument" when instrument_name is null', () => {
    renderWithI18n(
      <InstrumentCard instrumentId="inst-bp" instrumentName={null} series={[SYS]} />,
    )
    expect(screen.getByText(/onbekend instrument/i)).toBeInTheDocument()
  })

  it('toggles aria-expanded when the header is clicked', async () => {
    renderWithI18n(
      <InstrumentCard instrumentId="inst-bp" instrumentName="Bloeddruk" series={[SYS]} />,
    )
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.setup().click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders a categorical series renderer when expanded', async () => {
    renderWithI18n(
      <InstrumentCard
        instrumentId="inst-q"
        instrumentName="Klachten dagboek"
        series={[QUEST]}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByTestId('chip-stream')).toBeInTheDocument()
  })

  it('does not render the sparkline for a single-point series', () => {
    const single: NumericSeries = {
      ...SYS,
      points: [SYS.points[0]!],
    }
    renderWithI18n(
      <InstrumentCard
        instrumentId="inst-bp"
        instrumentName="Bloeddruk"
        series={[single]}
      />,
    )
    expect(screen.queryByTestId('sparkline')).toBeNull()
  })
})
