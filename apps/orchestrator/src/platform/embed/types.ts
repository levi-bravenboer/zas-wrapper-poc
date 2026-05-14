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

// Storage-shape with relaxed adapters/surfaces/smart. Registry holds these
// erased to AnyFeatureSpec because Port<P> is invariant in P (the Provider
// takes value: P contravariantly) so a heterogeneous Map of FeatureSpec<P>
// values cannot be typed without erasure. Mount components narrow via the
// surface guard; missing adapter is a misuse of the surface contract.
/* eslint-disable @typescript-eslint/no-explicit-any -- erasure boundary */
export type AnyAdapter = (deps: any) => any
export type AnyFeatureSpec = {
  readonly id: string
  readonly path: `/${string}`
  readonly titleKey: `nav.${string}`
  readonly page: ComponentType
  readonly port: Port<any>
  readonly surfaces: SurfaceTuple
  readonly adapters: Readonly<Record<string, AnyAdapter>>
  readonly nav?: { readonly icon: LucideIcon; readonly order?: number }
  readonly smart?: SmartBlock
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
