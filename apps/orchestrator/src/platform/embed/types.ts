import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import type { Port } from '@/platform/ports/createPort'
import type { SurfaceId } from '@/platform/surface/types'

import type { FhirDeps, OrchestratorDeps } from './depsContext'

export type OrchestratorAdapter<P> = (deps: OrchestratorDeps) => P
export type FhirAdapter<P> = (deps: FhirDeps) => P

export type SmartContextKind = 'patient' | 'encounter' | 'user'

export type SmartBlock = {
  readonly scopes: readonly string[]
  readonly requires: readonly SmartContextKind[]
}

export type SurfaceTuple = readonly SurfaceId[]

type AdaptersForSurfaces<S extends SurfaceTuple, P> = ('app' extends S[number]
  ? { readonly orchestrator: OrchestratorAdapter<P> }
  : unknown) &
  ('smart' extends S[number]
    ? { readonly fhir: FhirAdapter<P> }
    : 'embed' extends S[number]
      ? { readonly fhir: FhirAdapter<P> }
      : unknown)

type SmartRequirement<S extends SurfaceTuple> = 'smart' extends S[number]
  ? { readonly smart: SmartBlock }
  : 'embed' extends S[number]
    ? { readonly smart: SmartBlock }
    : { readonly smart?: never }

export type FeatureSpec<P = unknown, S extends SurfaceTuple = SurfaceTuple> = {
  readonly id: string
  readonly path: `/${string}`
  readonly titleKey: `nav.${string}`
  readonly page: ComponentType
  readonly port: Port<P>
  readonly surfaces: S
  readonly adapters: AdaptersForSurfaces<S, P>
  readonly nav?: { readonly icon: LucideIcon; readonly order?: number }
} & SmartRequirement<S>
