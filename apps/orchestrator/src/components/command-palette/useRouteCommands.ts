import { useRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { hardWiredNavItems } from '@/components/layout/navItems'
import { getFeaturesForSurface } from '@/platform/embed/defineFeature'

import { useRegisterCommands } from './context'
import type { CommandEntry } from './types'

// Built-in registration: every shell-known nav target becomes a palette entry.
// Mounted once by Shell.tsx; page-level hooks can add more via useRegisterCommands.
//
// Uses `router.history.push` so the entry can carry a `string` path (TanStack's
// `navigate({ to })` requires a route-tree-literal). Acceptable because the
// path comes from a typed registry (NavItem | FeatureSpec.path), not user input.
export function useRouteCommands(): void {
  const { t } = useTranslation(['shell', 'nav'])
  const router = useRouter()

  const entries = useMemo<readonly CommandEntry[]>(() => {
    const group = t('shell:palette.groups.routes')

    const fromHardWired = hardWiredNavItems.map<CommandEntry>((item) => ({
      id: `route:${item.to}`,
      label: t(item.labelKey.replace(/^nav\./, '')),
      group,
      icon: item.icon,
      perform: () => router.history.push(item.to),
    }))

    const fromFeatures = getFeaturesForSurface('app').flatMap<CommandEntry>((feature) =>
      feature.nav
        ? [
            {
              id: `route:${feature.path}`,
              label: t(feature.titleKey.replace(/^nav\./, '')),
              group,
              icon: feature.nav.icon,
              perform: () => router.history.push(feature.path),
            },
          ]
        : [],
    )

    return [...fromHardWired, ...fromFeatures]
  }, [router, t])

  useRegisterCommands('routes', entries)
}
