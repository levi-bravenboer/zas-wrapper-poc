import { createMemoryHistory, createRouter, type RouterHistory } from '@tanstack/react-router'

import { routeTree } from '@/routeTree.gen'

import { queryClient } from './queryClient'

function createAppHistory(): RouterHistory | undefined {
  if (typeof window === 'undefined') return undefined
  if (window.self === window.top) return undefined
  const initial = window.location.pathname + window.location.search
  return createMemoryHistory({ initialEntries: [initial] })
}

const embeddedHistory = createAppHistory()

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { queryClient },
  ...(embeddedHistory ? { history: embeddedHistory } : {}),
})

export type AppRouter = typeof router

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
