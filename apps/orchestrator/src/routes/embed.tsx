import { createFileRoute } from '@tanstack/react-router'

import { EmbedShell } from '@/platform/embed/EmbedShell'

// Reason: spec called for `_embed.tsx` but TanStack `_`-prefixed files create
// pathless layouts. Using `embed.tsx` produces the `/embed` base path the
// spec requires for HiX iframe surface URLs.
export const Route = createFileRoute('/embed')({
  component: EmbedShell,
})
