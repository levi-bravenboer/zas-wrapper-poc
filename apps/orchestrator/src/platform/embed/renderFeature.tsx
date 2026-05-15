import { useMemo, type ReactElement } from 'react'

import { useSurface } from '@/platform/surface/hooks'

import { useFhirDeps, useOrchestratorDeps } from './depsHooks'
import type { AnyFeatureSpec, FeatureSpec, SurfaceTuple } from './types'

// Reason: file exports both a HOC-style factory and internal mount components;
// react-refresh's "only components" rule does not fit the platform's renderFeature shape.
/* eslint-disable react-refresh/only-export-components */

export function renderFeature<P, S extends SurfaceTuple>(
  spec: FeatureSpec<P, S>,
): () => ReactElement {
  // Same variance erasure as defineFeature (see comment there).
  const base = spec as unknown as AnyFeatureSpec
  return function RenderedFeature(): ReactElement {
    const surface = useSurface()
    if (surface.data === 'orchestrator') {
      return <OrchestratorMount spec={base} />
    }
    return <FhirMount spec={base} />
  }
}

function OrchestratorMount({ spec }: { spec: AnyFeatureSpec }): ReactElement {
  const deps = useOrchestratorDeps()
  const adapter = spec.adapters.orchestrator
  if (!adapter) throw new Error(`feature '${spec.id}' missing orchestrator adapter`)
  const port = useMemo(() => adapter(deps), [adapter, deps])
  const { Provider } = spec.port
  const Page = spec.page
  return (
    <Provider value={port}>
      <Page />
    </Provider>
  )
}

function FhirMount({ spec }: { spec: AnyFeatureSpec }): ReactElement {
  const deps = useFhirDeps()
  const adapter = spec.adapters.fhir
  if (!adapter) throw new Error(`feature '${spec.id}' missing fhir adapter`)
  const port = useMemo(() => adapter(deps), [adapter, deps])
  const { Provider } = spec.port
  const Page = spec.page
  return (
    <Provider value={port}>
      <Page />
    </Provider>
  )
}
