import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-1)] text-[var(--color-text-1)]">
      <Outlet />
    </div>
  )
}
