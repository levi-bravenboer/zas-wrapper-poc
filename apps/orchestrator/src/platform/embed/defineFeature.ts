import type { SurfaceId } from '@/platform/surface/types'

import type { AnyFeatureSpec, FeatureSpec, SurfaceTuple } from './types'

const registry = new Map<string, AnyFeatureSpec>()

export function defineFeature<P, S extends SurfaceTuple>(
  spec: FeatureSpec<P, S>,
): FeatureSpec<P, S> {
  if (registry.has(spec.id)) {
    throw new Error(`feature '${spec.id}' already registered`)
  }
  // Erase the (P, S) generics for storage. AdaptersForSurfaces<S, P> is a
  // generic conditional that TS cannot prove assignable to the relaxed
  // AnyFeatureSpec shape, so the boundary requires one widening cast. All
  // accessors return AnyFeatureSpec; consumers narrow via the surface guard.
  registry.set(spec.id, spec as unknown as AnyFeatureSpec)
  return spec
}

export function getFeatures(): readonly AnyFeatureSpec[] {
  return Array.from(registry.values())
}

export function getFeaturesForSurface(id: SurfaceId): readonly AnyFeatureSpec[] {
  return getFeatures().filter((feature) => feature.surfaces.includes(id))
}

export function getFeatureById(id: string): AnyFeatureSpec | undefined {
  return registry.get(id)
}

export function getRequiredScopes(): readonly string[] {
  return [...new Set([...registry.values()].flatMap((f) => f.smart?.scopes ?? []))]
}

// Reason: module-scoped registry must be wiped between tests to keep them isolated.
export function __resetFeatureRegistryForTests(): void {
  registry.clear()
}
