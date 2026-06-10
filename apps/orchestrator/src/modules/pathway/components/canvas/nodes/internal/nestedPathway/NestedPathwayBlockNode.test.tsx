import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { pathwayKeys } from '../../../../../keys'
import type { PathwayBlock, PathwayChildSummary, PathwayWithVersion } from '../../../../../types'
import { BuilderFlushProvider } from '../../../BuilderFlushContext'

import { NestedPathwayBlockNode } from './NestedPathwayBlockNode'

vi.mock('./NestedPathwayThumbnail', () => ({
  NestedPathwayThumbnail: () => <div data-testid="thumbnail-stub" />,
}))
vi.mock('../../BlockNodeHandles', () => ({
  BlockNodeHandles: () => null,
}))

const CHILD_ID = '00000000-0000-4000-8000-000000000002'

function summary(overrides: Partial<PathwayChildSummary> = {}): PathwayChildSummary {
  return {
    id: CHILD_ID,
    name: 'Hartfalen vervolgpad',
    lane_count: 3,
    block_count: 12,
    latest_published_version_id: 'abcdef1234567890',
    ...overrides,
  }
}

function detail(): PathwayWithVersion {
  return {
    id: CHILD_ID,
    name: 'Hartfalen vervolgpad',
    version: {
      phases: [],
      lanes: [],
      blocks: [],
      edges: [],
    },
  } as unknown as PathwayWithVersion
}

function makeBlock(targetId: string | null): PathwayBlock {
  // Slot #2 §6: typed envelope hoists per-kind fields directly. The
  // `legacyBlockConfig` helper synthesises the legacy config bag by
  // excluding envelope keys, so target / mode live on the envelope.
  return {
    id: 'block-1',
    kind: 'pathway_link',
    name: '',
    input_logic: { rules: [], aggregator: 'all_of' },
    timing_policy: null,
    ...(targetId ? { target_pathway_id: targetId, mode: 'blocking' } : {}),
  } as unknown as PathwayBlock
}

type RenderOpts = {
  targetId?: string | null
  flush?: () => void
  saveState?: 'clean' | 'dirty' | 'saving' | 'error'
  withSummary?: boolean
}

function renderNode({
  targetId = CHILD_ID,
  flush = vi.fn(),
  saveState = 'clean',
  withSummary = true,
}: RenderOpts = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (withSummary && targetId) {
    qc.setQueryData(pathwayKeys.summary(targetId), summary())
    qc.setQueryData(pathwayKeys.detail(targetId), detail())
  }

  const data = {
    block: makeBlock(targetId),
    blockType: null,
    lane: null,
    duration: null,
    isEntry: false,
  }

  const NodeStub = () => (
    <NestedPathwayBlockNode
      id="n-1"
      data={data}
      selected={false}
      type="block"
      zIndex={0}
      isConnectable={false}
      xPos={0}
      yPos={0}
      dragging={false}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({} as any)}
    />
  )

  const rootRoute = createRootRoute()
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: NodeStub,
  })
  const childRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/pathways/$pathwayId',
    component: () => <div data-testid="child-route">child</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, childRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <BuilderFlushProvider flush={flush} saveState={saveState}>
          <RouterProvider router={router} />
        </BuilderFlushProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  )

  return { qc, router, flush }
}

describe('NestedPathwayBlockNode (8.2)', () => {
  describe('container rendering', () => {
    it('renders child name, lane count, block count, and Open CTA from summary', async () => {
      renderNode()

      expect(await screen.findByText('Hartfalen vervolgpad')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /open sub-zorgpad/i })).toBeInTheDocument()
    })

    it('renders empty title when no target is configured', async () => {
      renderNode({ targetId: null, withSummary: false })

      expect(await screen.findByText(/geen doel/i)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /open sub-zorgpad/i })).not.toBeInTheDocument()
    })
  })

  describe('drill-down navigation', () => {
    it('Open CTA points to /pathways/<child-id>', async () => {
      renderNode()

      const link = await screen.findByRole('link', { name: /open sub-zorgpad/i })
      expect(link.getAttribute('href')).toContain(`/pathways/${CHILD_ID}`)
    })
  })

  describe('autosave-flush interaction', () => {
    it('calls flush() when Open CTA is clicked', async () => {
      const flush = vi.fn()
      renderNode({ flush })

      const link = await screen.findByRole('link', { name: /open sub-zorgpad/i })
      await userEvent.click(link)

      expect(flush).toHaveBeenCalledTimes(1)
    })

    it('renders "saving…" indicator when saveState is saving', async () => {
      renderNode({ saveState: 'saving' })

      expect(await screen.findByText(/opslaan|saving/i)).toBeInTheDocument()
    })
  })
})
