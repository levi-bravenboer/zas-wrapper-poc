import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it } from 'vitest'

import { DATA_TABLE_DEFAULT_STATE, type DataTableState } from './use-data-table-state'
import { composeTableState, useRouteSearchTableState } from './use-route-search-table-state'

type HookReturn = ReturnType<typeof useRouteSearchTableState>

/**
 * Mount the hook inside a memory router and expose the most recent
 * [state, dispatch] tuple through a ref so tests can interact with it.
 *
 * We can't use `renderHook` directly because the hook needs to live inside
 * a route's component (so `useSearch` can resolve the active match). We
 * render the hook as the route's component, then forward its return value
 * up through `ref.current`.
 */
function mountTableRoute(initialPath: string): {
  ref: { current: HookReturn | null }
  unmount: () => void
} {
  const ref: { current: HookReturn | null } = { current: null }

  function HookHost(): null {
    const value = useRouteSearchTableState()
    ref.current = value
    return null
  }

  const rootRoute = createRootRoute()
  const tableRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/table',
    validateSearch: (search: Record<string, unknown>) => search,
    component: HookHost,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([tableRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  const utils = render(<RouterProvider router={router} />)
  return { ref, unmount: utils.unmount }
}

describe('composeTableState', () => {
  it('merges defaults under localStorage under URL', () => {
    const merged = composeTableState({ page: 3 }, { pageSize: 50 })
    expect(merged.page).toBe(3)
    expect(merged.pageSize).toBe(50)
    expect(merged.q).toBeNull()
  })

  it('URL wins over localStorage on shared fields', () => {
    const merged = composeTableState({ pageSize: 100 }, { pageSize: 50 })
    expect(merged.pageSize).toBe(100)
  })

  it('returns plain defaults when both inputs are empty', () => {
    expect(composeTableState(undefined, undefined)).toEqual(DATA_TABLE_DEFAULT_STATE)
  })
})

describe('useRouteSearchTableState', () => {
  it('initialises state from the URL search params on mount', async () => {
    const { ref, unmount } = mountTableRoute('/table?page=2&pageSize=50')
    try {
      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })
      const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
      expect(state.page).toBe(2)
      expect(state.pageSize).toBe(50)
    } finally {
      unmount()
    }
  })

  it('updates the router search when setPage is dispatched', async () => {
    const { ref, unmount } = mountTableRoute('/table')
    try {
      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await act(async () => {
        const [, dispatch] = ref.current as readonly [DataTableState, HookReturn[1]]
        dispatch.setPage(3)
      })

      await waitFor(() => {
        const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
        expect(state.page).toBe(3)
      })
    } finally {
      unmount()
    }
  })

  it('falls back to defaults when the URL is empty', async () => {
    const { ref, unmount } = mountTableRoute('/table')
    try {
      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })
      const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
      expect(state).toEqual(DATA_TABLE_DEFAULT_STATE)
    } finally {
      unmount()
    }
  })

  it('clears stale q from the URL when search is reset to null', async () => {
    const { ref, unmount } = mountTableRoute('/table?q=foo')
    try {
      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await act(async () => {
        const [, dispatch] = ref.current as readonly [DataTableState, HookReturn[1]]
        dispatch.setSearch(null)
      })

      await waitFor(() => {
        const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
        expect(state.q).toBeNull()
      })
    } finally {
      unmount()
    }
  })

  it('clears stale filters from the URL when clearAll is dispatched', async () => {
    const { ref, unmount } = mountTableRoute('/table')
    try {
      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await act(async () => {
        const [, dispatch] = ref.current as readonly [DataTableState, HookReturn[1]]
        dispatch.setFilter('status', { op: 'eq', value: 'active' })
      })
      await waitFor(() => {
        const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
        expect(state.filters['status']).toBeDefined()
      })

      await act(async () => {
        const [, dispatch] = ref.current as readonly [DataTableState, HookReturn[1]]
        dispatch.clearAll()
      })

      await waitFor(() => {
        const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
        expect(state.filters).toEqual({})
      })
    } finally {
      unmount()
    }
  })

  it('persists dispatched filters through the URL', async () => {
    const { ref, unmount } = mountTableRoute('/table')
    try {
      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await act(async () => {
        const [, dispatch] = ref.current as readonly [DataTableState, HookReturn[1]]
        dispatch.setFilter('status', { op: 'eq', value: 'active' })
      })

      await waitFor(() => {
        const [state] = ref.current as readonly [DataTableState, HookReturn[1]]
        expect(state.filters['status']).toEqual({ op: 'eq', value: 'active' })
      })
    } finally {
      unmount()
    }
  })
})

// Quiet the React import in this file — it's used by JSX.
void React
