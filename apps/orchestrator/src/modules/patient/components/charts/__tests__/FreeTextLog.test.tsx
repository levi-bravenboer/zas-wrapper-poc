import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { FreeTextLog } from '../FreeTextLog'
import type { FreeTextSeries } from '../types'

const LONG = 'a '.repeat(200).trim()

function makeSeries(text: string): FreeTextSeries {
  return {
    series_id: 'sid',
    instrument_id: 'inst-q',
    instrument_name: 'Open vraag',
    item_id: 'item-free',
    label: 'Open vraag',
    archetype: 'free_text',
    points: [
      {
        observed_at: '2026-06-13T20:00:00Z',
        archetype: 'free_text',
        text,
      },
    ],
  }
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('FreeTextLog', () => {
  it('renders text as-is when shorter than the truncation threshold', () => {
    renderWithI18n(<FreeTextLog series={makeSeries('Voelt me ok.')} />)
    expect(screen.getByText('Voelt me ok.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /meer tonen/i })).toBeNull()
  })

  it('truncates long entries and toggles full text via the show-more button', async () => {
    renderWithI18n(<FreeTextLog series={makeSeries(LONG)} />)
    const trigger = screen.getByRole('button', { name: /meer tonen/i })
    expect(trigger).toBeInTheDocument()
    expect(screen.getByText((content) => content.endsWith('…'))).toBeInTheDocument()

    await userEvent.setup().click(trigger)
    expect(screen.getByRole('button', { name: /minder tonen/i })).toBeInTheDocument()
    // Full text now visible — last word of the LONG string is `a`.
    expect(screen.getByText((c) => c.endsWith('a'))).toBeInTheDocument()
  })
})
