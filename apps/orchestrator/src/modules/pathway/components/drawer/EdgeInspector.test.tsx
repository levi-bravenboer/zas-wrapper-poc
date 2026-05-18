import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type {
  PathwayBlock,
  PathwayBlockBranch,
  PathwayEdge,
  PathwayEdgeOffsetDirection,
  PathwayEdgeTimingKind,
  PathwayTimeMarker,
  PathwayTimingValue,
} from '../../types'

import { EdgeInspector } from './EdgeInspector'

const emptySchema = { config_schema: {}, ui_schema: {} }

const timingKinds: PathwayEdgeTimingKind[] = [
  { kind: 'completion', label: 'Bij voltooiing', ...emptySchema },
  { kind: 'marker', label: 'Bij tijdmarker', ...emptySchema },
  { kind: 'immediate', label: 'Direct', ...emptySchema },
  { kind: 'branch', label: 'Bij vertakking', ...emptySchema },
]

const offsetDirections: PathwayEdgeOffsetDirection[] = [
  { code: 'before', label: 'Voor', ord: 10 },
  { code: 'after', label: 'Na', ord: 20 },
]

const timingValues: PathwayTimingValue[] = [
  { id: 'v1', kind: 'enrollment', enrollment_default_days: 0 },
  { id: 'v2', kind: 'fixed', fixed_days: 3 },
]

const timeMarkers: PathwayTimeMarker[] = [{ id: 'm1', value_id: 'v1', label: 'Operatie' }]

const blocks: PathwayBlock[] = []

const branches: PathwayBlockBranch[] = [
  { id: 'br1', block_id: 'src-block', label: 'Ja', ord: 10 },
  { id: 'br2', block_id: 'src-block', label: 'Nee', ord: 20 },
]

function makeEdge(overrides: Partial<PathwayEdge> = {}): PathwayEdge {
  return {
    id: 'edge-1',
    source_block_id: 'src-block',
    target_block_id: 'tgt-block',
    delay_value_id: null,
    time_marker_id: null,
    offset_value_id: null,
    offset_direction_code: null,
    source_branch_id: null,
    ...overrides,
  }
}

function wrap(children: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

describe('EdgeInspector', () => {
  it('renders all timing-kind tabs and marks the active one', () => {
    const edge = makeEdge({ delay_value_id: 'v2' })
    render(
      wrap(
        <EdgeInspector
          edge={edge}
          timingKinds={timingKinds}
          offsetDirections={offsetDirections}
          timingValues={timingValues}
          timeMarkers={timeMarkers}
          blocks={blocks}
          branches={branches}
          onPatchEdge={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    const active = tabs.find((b) => b.getAttribute('aria-selected') === 'true')
    expect(active?.textContent).toMatch(/voltooiing/i)
  })

  it('clears prior columns when switching to immediate', async () => {
    const onPatchEdge = vi.fn()
    const edge = makeEdge({ delay_value_id: 'v2' })
    render(
      wrap(
        <EdgeInspector
          edge={edge}
          timingKinds={timingKinds}
          offsetDirections={offsetDirections}
          timingValues={timingValues}
          timeMarkers={timeMarkers}
          blocks={blocks}
          branches={branches}
          onPatchEdge={onPatchEdge}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    )
    const directTab = screen.getAllByRole('tab').find((b) => /direct/i.test(b.textContent ?? ''))
    expect(directTab).toBeTruthy()
    await userEvent.click(directTab!)
    expect(onPatchEdge).toHaveBeenCalledWith({
      delay_value_id: null,
      time_marker_id: null,
      offset_value_id: null,
      offset_direction_code: null,
      source_branch_id: null,
    })
  })

  it('pre-selects the only branch when switching to branch on a block with one branch', async () => {
    const onPatchEdge = vi.fn()
    const oneBranch: PathwayBlockBranch[] = [
      { id: 'only', block_id: 'src-block', label: 'Ja', ord: 10 },
    ]
    const edge = makeEdge()
    render(
      wrap(
        <EdgeInspector
          edge={edge}
          timingKinds={timingKinds}
          offsetDirections={offsetDirections}
          timingValues={timingValues}
          timeMarkers={timeMarkers}
          blocks={blocks}
          branches={oneBranch}
          onPatchEdge={onPatchEdge}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    )
    const branchTab = screen
      .getAllByRole('tab')
      .find((b) => /vertakking/i.test(b.textContent ?? ''))
    await userEvent.click(branchTab!)
    expect(onPatchEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        source_branch_id: 'only',
        delay_value_id: null,
        time_marker_id: null,
      }),
    )
  })
})
