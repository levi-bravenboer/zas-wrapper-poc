import { createFileRoute, redirect } from '@tanstack/react-router'

export function authIndexBeforeLoad(): never {
  throw redirect({ to: '/dashboard' })
}

export const Route = createFileRoute('/_auth/')({
  beforeLoad: authIndexBeforeLoad,
})
