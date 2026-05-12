import { createRouter } from '@tanstack/react-router'

import { routeTree } from '@/routeTree.gen'

import { queryClient } from './queryClient'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { queryClient },
})

export type AppRouter = typeof router

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
