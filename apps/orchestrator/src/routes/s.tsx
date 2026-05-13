import { createFileRoute } from '@tanstack/react-router'

import { SmartShell } from '@/platform/embed/SmartShell'

// Reason: spec called for `_smart.tsx` but TanStack `_`-prefixed files create
// pathless layouts. Using `s.tsx` produces the `/s` base path the spec
// requires for `app` -> `smart` surface URLs.
export const Route = createFileRoute('/s')({
  component: SmartShell,
})
