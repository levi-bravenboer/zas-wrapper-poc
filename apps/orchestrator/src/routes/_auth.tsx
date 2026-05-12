import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { fetchSession } from '@/modules/auth/api'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { session }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return <Outlet />
}
