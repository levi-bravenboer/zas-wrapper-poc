import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { PathwayVersionDefinition, PathwayVersionSummary } from '../../types'

const { versionListState, forkMock, restoreMock, navigateMock } = vi.hoisted(() => ({
  versionListState: { data: [] as PathwayVersionSummary[] },
  forkMock: vi.fn(),
  restoreMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../../hooks', () => ({
  usePathwayVersions: () => versionListState,
  useForkPathwayFromPublish: () => ({ mutate: forkMock, isPending: false }),
  useRestorePathwayVersion: () => ({ mutate: restoreMock, isPending: false }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { ReadOnlyBanner } from './ReadOnlyBanner'

function makeVersion(
  overrides: Partial<PathwayVersionDefinition> = {},
): PathwayVersionDefinition {
  return {
    id: 'v-1',
    pathway_id: 'p-1',
    version_no: 3,
    status: 'published',
    kind: 'initial',
    phases: [],
    ...overrides,
  } as unknown as PathwayVersionDefinition
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
  forkMock.mockReset()
  restoreMock.mockReset()
  navigateMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ReadOnlyBanner', () => {
  it('published-fallback variant shows Maak nieuwe versie CTA', () => {
    render(
      <ReadOnlyBanner pathwayId="p-1" version={makeVersion()} variant="published-fallback" />,
      { wrapper: Wrapper },
    )
    expect(screen.getByText(/maak nieuwe versie/i)).toBeInTheDocument()
    expect(screen.queryByText(/terug naar huidige/i)).not.toBeInTheDocument()
  })

  it('historical variant shows restore CTA + back-to-current ghost', () => {
    render(
      <ReadOnlyBanner pathwayId="p-1" version={makeVersion()} variant="historical" />,
      { wrapper: Wrapper },
    )
    expect(screen.getByText(/herstel als nieuw concept/i)).toBeInTheDocument()
    expect(screen.getByText(/terug naar huidige/i)).toBeInTheDocument()
  })

  it('historical CTA opens concept-exists swap when a concept exists', async () => {
    versionListState.data = [
      {
        id: 'v-2',
        pathway_id: 'p-1',
        version_no: 5,
        status: 'concept',
        kind: 'initial',
        created_at: '2026-01-01',
      } as unknown as PathwayVersionSummary,
    ]
    render(
      <ReadOnlyBanner pathwayId="p-1" version={makeVersion()} variant="historical" />,
      { wrapper: Wrapper },
    )
    await userEvent.click(screen.getByText(/herstel als nieuw concept/i))
    expect(screen.getByText(/open bestaande concept/i)).toBeInTheDocument()
    expect(screen.getByText(/v\.5/i)).toBeInTheDocument()
    expect(restoreMock).not.toHaveBeenCalled()
  })
})
