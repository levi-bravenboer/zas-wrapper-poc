import type { SurfaceId } from '@/platform/surface/types'

import type { FeatureSpec, SmartBlock, SurfaceTuple } from './types'

const registry = new Map<string, FeatureSpec>()

export function defineFeature<P, S extends SurfaceTuple>(
  spec: FeatureSpec<P, S>,
): FeatureSpec<P, S> {
  if (registry.has(spec.id)) {
    throw new Error(`feature '${spec.id}' already registered`)
  }
  registry.set(spec.id, spec as unknown as FeatureSpec)
  return spec
}

export function getFeatures(): readonly FeatureSpec[] {
  return Array.from(registry.values())
}

export function getFeaturesForSurface(id: SurfaceId): readonly FeatureSpec[] {
  return getFeatures().filter((feature) => feature.surfaces.includes(id))
}

export function getFeatureById(id: string): FeatureSpec | undefined {
  return registry.get(id)
}

export function getRequiredScopes(): readonly string[] {
  const scopes = new Set<string>()
  for (const feature of registry.values()) {
    const smart = (feature as { smart?: SmartBlock }).smart
    if (smart) {
      for (const scope of smart.scopes) scopes.add(scope)
    }
  }
  return Array.from(scopes)
}

// Reason: module-scoped registry must be wiped between tests to keep them isolated.
export function __resetFeatureRegistryForTests(): void {
  registry.clear()
}
