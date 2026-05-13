import { useMemo, type ReactElement, type ReactNode } from 'react'

import { FhirDepsProvider } from '@/platform/embed/deps'
import type { FhirDeps } from '@/platform/embed/depsContext'

import { SmartTokenMissingError } from './errors'
import { useLaunchContext } from './useLaunchContext'

export function SmartProvider({ children }: { children: ReactNode }): ReactElement {
  const context = useLaunchContext()
  const deps = useMemo<FhirDeps | null>(() => {
    if (!context || !context.client || !context.token) return null
    return { client: context.client, ctx: context.ctx }
  }, [context])

  if (!deps) {
    throw new SmartTokenMissingError()
  }
  return <FhirDepsProvider deps={deps}>{children}</FhirDepsProvider>
}
