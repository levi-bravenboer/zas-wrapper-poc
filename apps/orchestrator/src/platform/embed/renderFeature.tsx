import { useMemo, type ReactElement } from 'react'

import { useSurface } from '@/platform/surface/hooks'

import { useFhirDeps, useOrchestratorDeps } from './depsHooks'
import type { FeatureSpec, FhirAdapter, OrchestratorAdapter, SurfaceTuple } from './types'

// Reason: file exports both a HOC-style factory and internal mount components;
// react-refresh's "only components" rule does not fit the platform's renderFeature shape.
/* eslint-disable react-refresh/only-export-components */

export function renderFeature<P, S extends SurfaceTuple>(
  spec: FeatureSpec<P, S>,
): () => ReactElement {
  // Cast to the wide spec for the inner mount components, which never read
  // surface-specific adapter keys outside their guarded branch.
  const wideSpec = spec as unknown as FeatureSpec<P>
  return function RenderedFeature(): ReactElement {
    const surface = useSurface()
    if (surface.data === 'orchestrator') {
      return <OrchestratorMount spec={wideSpec} />
    }
    return <FhirMount spec={wideSpec} />
  }
}

function OrchestratorMount<P>({ spec }: { spec: FeatureSpec<P> }): ReactElement {
  const deps = useOrchestratorDeps()
  const adapter = (spec.adapters as { orchestrator: OrchestratorAdapter<P> }).orchestrator
  const port = useMemo(() => adapter(deps), [adapter, deps])
  const { Provider } = spec.port
  const Page = spec.page
  return (
    <Provider value={port}>
      <Page />
    </Provider>
  )
}

function FhirMount<P>({ spec }: { spec: FeatureSpec<P> }): ReactElement {
  const deps = useFhirDeps()
  const adapter = (spec.adapters as { fhir: FhirAdapter<P> }).fhir
  const port = useMemo(() => adapter(deps), [adapter, deps])
  const { Provider } = spec.port
  const Page = spec.page
  return (
    <Provider value={port}>
      <Page />
    </Provider>
  )
}
