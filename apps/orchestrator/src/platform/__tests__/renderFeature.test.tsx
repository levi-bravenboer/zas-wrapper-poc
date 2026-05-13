import { render, screen } from '@testing-library/react'
import type Client from 'fhirclient/lib/Client'
import { describe, expect, it, vi } from 'vitest'

import {
  FhirDepsProvider,
  OrchestratorDepsProvider,
} from '@/platform/embed/deps'
import type { FhirDeps } from '@/platform/embed/depsContext'
import { renderFeature } from '@/platform/embed/renderFeature'
import type { FeatureSpec } from '@/platform/embed/types'
import { createPort } from '@/platform/ports/createPort'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

const fakeFhirDeps: FhirDeps = {
  client: { state: { tokenResponse: {} } } as unknown as Client,
  ctx: { patient: { id: 'p1', reference: 'Patient/p1' } },
}

type ExamplePort = { readonly source: 'orchestrator' | 'fhir' }

function buildSpec(): {
  spec: FeatureSpec<ExamplePort>
  orchestratorAdapter: ReturnType<typeof vi.fn>
  fhirAdapter: ReturnType<typeof vi.fn>
} {
  const port = createPort<ExamplePort>('Example')
  const orchestratorAdapter = vi.fn(() => ({ source: 'orchestrator' as const }))
  const fhirAdapter = vi.fn(() => ({ source: 'fhir' as const }))

  function Page(): string {
    return port.use().source
  }

  const spec = {
    id: 'example',
    path: '/example',
    titleKey: 'nav.example',
    page: Page,
    port,
    surfaces: ['app', 'embed'] as const,
    adapters: {
      orchestrator: orchestratorAdapter,
      fhir: fhirAdapter,
    },
    smart: { scopes: ['patient/Example.read'], requires: ['patient'] as const },
  } as unknown as FeatureSpec<ExamplePort>

  return { spec, orchestratorAdapter, fhirAdapter }
}

describe('renderFeature', () => {
  it('selects the orchestrator adapter inside the app surface', () => {
    const { spec, orchestratorAdapter, fhirAdapter } = buildSpec()
    // eslint-disable-next-line testing-library/render-result-naming-convention -- this is the platform's renderFeature helper, not RTL's render
    const Feature = renderFeature(spec)

    render(
      <SurfaceProvider surface={SURFACES.app}>
        <OrchestratorDepsProvider deps={{ api: 'fake-api' }}>
          <Feature />
        </OrchestratorDepsProvider>
      </SurfaceProvider>,
    )

    expect(screen.getByText('orchestrator')).toBeInTheDocument()
    expect(orchestratorAdapter).toHaveBeenCalledExactlyOnceWith({ api: 'fake-api' })
    expect(fhirAdapter).not.toHaveBeenCalled()
  })

  it('selects the fhir adapter inside the embed surface', () => {
    const { spec, orchestratorAdapter, fhirAdapter } = buildSpec()
    // eslint-disable-next-line testing-library/render-result-naming-convention -- this is the platform's renderFeature helper, not RTL's render
    const Feature = renderFeature(spec)

    render(
      <SurfaceProvider surface={SURFACES.embed}>
        <FhirDepsProvider deps={fakeFhirDeps}>
          <Feature />
        </FhirDepsProvider>
      </SurfaceProvider>,
    )

    expect(screen.getByText('fhir')).toBeInTheDocument()
    expect(fhirAdapter).toHaveBeenCalledExactlyOnceWith(fakeFhirDeps)
    expect(orchestratorAdapter).not.toHaveBeenCalled()
  })

  it('memoizes the port across re-renders with identical deps', () => {
    const { spec, orchestratorAdapter } = buildSpec()
    // eslint-disable-next-line testing-library/render-result-naming-convention -- this is the platform's renderFeature helper, not RTL's render
    const Feature = renderFeature(spec)
    const deps = { api: 'stable' as const }

    const { rerender } = render(
      <SurfaceProvider surface={SURFACES.app}>
        <OrchestratorDepsProvider deps={deps}>
          <Feature />
        </OrchestratorDepsProvider>
      </SurfaceProvider>,
    )
    rerender(
      <SurfaceProvider surface={SURFACES.app}>
        <OrchestratorDepsProvider deps={deps}>
          <Feature />
        </OrchestratorDepsProvider>
      </SurfaceProvider>,
    )

    expect(orchestratorAdapter).toHaveBeenCalledOnce()
  })
})
