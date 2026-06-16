import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { ConfigForSemantics } from '../../../configSchemas'
import { pathwayKeys } from '../../../keys'
import type { PathwaySummary } from '../../../types'

import { PathwayLinkInspector } from './PathwayLinkInspector'

const PARENT_ID = '00000000-0000-4000-8000-000000000001'
const CHILD_ID = '00000000-0000-4000-8000-000000000002'

function listFixture(): PathwaySummary[] {
  return [
    {
      id: CHILD_ID,
      name: 'Hartfalen vervolgpad',
      latest_published_version_id: 'pub-1',
      updated_at: '2026-05-01T00:00:00Z',
    },
    {
      id: PARENT_ID,
      name: 'Hoofdpad',
      latest_published_version_id: 'pub-0',
      updated_at: '2026-05-02T00:00:00Z',
    },
  ] as unknown as PathwaySummary[]
}

function renderInspector(
  config: ConfigForSemantics<'pathway_link'>,
  onChange: (next: ConfigForSemantics<'pathway_link'>) => void = vi.fn(),
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(pathwayKeys.list(), listFixture())

  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <PathwayLinkInspector config={config} currentPathwayId={PARENT_ID} onChange={onChange} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return { onChange }
}

describe('PathwayLinkInspector (8.2)', () => {
  it('renders the InspectorHeaderChip and target field label', () => {
    renderInspector({ target_pathway_id: CHILD_ID, mode: 'blocking', context_mapping: {} })

    expect(screen.getByText('Subpath')).toBeInTheDocument()
    expect(screen.getByText(/Doel-zorgpad/i)).toBeInTheDocument()
  })

  it('renders context-mapping rows for existing entries', () => {
    renderInspector({
      target_pathway_id: CHILD_ID,
      mode: 'blocking',
      context_mapping: { patient_id: 'parent.patient_id' },
    })

    expect(screen.getByDisplayValue('patient_id')).toBeInTheDocument()
    expect(screen.getByDisplayValue('parent.patient_id')).toBeInTheDocument()
  })

  it('adds a new context-mapping entry when "Add" is clicked', async () => {
    const onChange = vi.fn()
    renderInspector(
      { target_pathway_id: CHILD_ID, mode: 'blocking', context_mapping: {} },
      onChange,
    )

    await userEvent.click(screen.getByRole('button', { name: /koppeling toevoegen/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        context_mapping: { new_key: '' },
      }),
    )
  })

  it('removes a mapping entry when its remove button is clicked', async () => {
    const onChange = vi.fn()
    renderInspector(
      {
        target_pathway_id: CHILD_ID,
        mode: 'blocking',
        context_mapping: { patient_id: 'parent.patient_id' },
      },
      onChange,
    )

    await userEvent.click(screen.getByRole('button', { name: /verwijder koppeling/i }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ context_mapping: {} }))
  })

  it('renames a mapping key when the key input changes', async () => {
    const onChange = vi.fn()
    renderInspector(
      {
        target_pathway_id: CHILD_ID,
        mode: 'blocking',
        context_mapping: { a: '1' },
      },
      onChange,
    )

    const keyInput = screen.getByDisplayValue('a')
    fireEvent.change(keyInput, { target: { value: 'b' } })

    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall?.context_mapping).toEqual({ b: '1' })
  })
})
