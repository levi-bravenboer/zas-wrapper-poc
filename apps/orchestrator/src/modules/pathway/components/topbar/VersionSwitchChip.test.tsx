import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { PathwayVersionDefinition, PathwayVersionSummary } from '../../types'

const { versionListState, navigateMock } = vi.hoisted(() => ({
  versionListState: { data: [] as PathwayVersionSummary[] },
  navigateMock: vi.fn(),
}))

vi.mock('../../hooks', () => ({
  usePathwayVersions: () => versionListState,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

import { VersionSwitchChip } from './VersionSwitchChip'

function makeVersion(
  overrides: Partial<PathwayVersionDefinition> = {},
): PathwayVersionDefinition {
  return {
    id: 'v-concept',
    pathway_id: 'p-1',
    version_no: 3,
    status: 'concept',
    kind: 'initial',
    phases: [],
    ...overrides,
  } as unknown as PathwayVersionDefinition
}

function row(over: Partial<PathwayVersionSummary>): PathwayVersionSummary {
  return {
    id: 'x',
    pathway_id: 'p-1',
    version_no: 1,
    status: 'published',
    kind: 'initial',
    created_at: '2026-01-01',
    ...over,
  } as unknown as PathwayVersionSummary
}

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  versionListState.data = []
  navigateMock.mockReset()
})

describe('VersionSwitchChip navigation rule', () => {
  it('selecting the version that bare resolves to → bare URL', async () => {
    versionListState.data = [
      row({ id: 'v-concept', version_no: 3, status: 'concept' }),
      row({ id: 'v-pub', version_no: 2, status: 'published' }),
    ]
    render(
      <VersionSwitchChip
        pathwayId="p-1"
        currentVersion={makeVersion()}
        onOpenHistory={() => undefined}
      />,
      { wrapper: Wrapper },
    )
    await userEvent.click(screen.getByTestId('version-switch-chip'))
    const items = await screen.findAllByRole('menuitem')
    const conceptRow = items.find((el) => /v\.3/i.test(el.textContent ?? ''))
    if (!conceptRow) throw new Error('concept row not found')
    await userEvent.click(conceptRow)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/pathways/$pathwayId',
      params: { pathwayId: 'p-1' },
    })
  })

  it('selecting a non-current published row → /v/{versionId}', async () => {
    versionListState.data = [
      row({ id: 'v-concept', version_no: 3, status: 'concept' }),
      row({ id: 'v-pub-2', version_no: 2, status: 'published' }),
      row({ id: 'v-pub-1', version_no: 1, status: 'published' }),
    ]
    render(
      <VersionSwitchChip
        pathwayId="p-1"
        currentVersion={makeVersion()}
        onOpenHistory={() => undefined}
      />,
      { wrapper: Wrapper },
    )
    await userEvent.click(screen.getByTestId('version-switch-chip'))
    const items = await screen.findAllByRole('menuitem')
    const target = items.find((el) => /v\.1/i.test(el.textContent ?? ''))
    if (!target) throw new Error('v.1 row not found')
    await userEvent.click(target)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/pathways/$pathwayId/v/$versionId',
      params: { pathwayId: 'p-1', versionId: 'v-pub-1' },
    })
  })
})
