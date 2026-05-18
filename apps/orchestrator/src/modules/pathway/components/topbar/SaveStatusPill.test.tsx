import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { SaveStatusPill, type SaveState } from './SaveStatusPill'

function withI18n(node: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
}

describe('SaveStatusPill', () => {
  const cases: Array<{ state: SaveState; expected: RegExp }> = [
    { state: 'clean', expected: /opgeslagen|saved/i },
    { state: 'dirty', expected: /wijzigingen|dirty|niet/i },
    { state: 'saving', expected: /opslaan|saving/i },
    { state: 'error', expected: /fout|error|mislukt/i },
  ]

  it.each(cases)('renders $state state with role=status', ({ state, expected }) => {
    render(withI18n(<SaveStatusPill state={state} />))
    const node = screen.getByRole('status')
    expect(node).toBeInTheDocument()
    expect(node.textContent ?? '').toMatch(expected)
  })

  it('distinguishes saving vs dirty copy', () => {
    const { rerender } = render(withI18n(<SaveStatusPill state="saving" />))
    expect(screen.getByRole('status').textContent ?? '').toMatch(/opslaan|saving/i)

    rerender(withI18n(<SaveStatusPill state="dirty" />))
    expect(screen.getByRole('status').textContent ?? '').toMatch(/niet|dirty/i)
  })
})
