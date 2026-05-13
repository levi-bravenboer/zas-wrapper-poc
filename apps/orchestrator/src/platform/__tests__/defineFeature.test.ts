import { afterEach, describe, expect, it } from 'vitest'

import {
  __resetFeatureRegistryForTests,
  defineFeature,
  getFeatureById,
  getFeatures,
  getFeaturesForSurface,
  getRequiredScopes,
} from '@/platform/embed/defineFeature'
import { createPort } from '@/platform/ports/createPort'

type FakePort = { readonly list: () => readonly string[] }

function buildFakeFeature(id: string, surfaces: readonly ('app' | 'smart' | 'embed')[]) {
  const port = createPort<FakePort>(`${id}-port`)
  const orchestrator = () => ({ list: () => [] })
  const fhir = () => ({ list: () => [] })
  const includesApp = surfaces.includes('app')
  const includesFhir = surfaces.includes('smart') || surfaces.includes('embed')
  const adapters = {
    ...(includesApp ? { orchestrator } : {}),
    ...(includesFhir ? { fhir } : {}),
  }
  return {
    id,
    path: `/${id}` as const,
    titleKey: `nav.${id}` as const,
    page: () => null,
    port,
    surfaces,
    adapters,
    ...(includesFhir
      ? { smart: { scopes: [`patient/${id}.read`], requires: ['patient'] as const } }
      : {}),
  }
}

afterEach(() => {
  __resetFeatureRegistryForTests()
})

describe('defineFeature', () => {
  it('registers the feature so it appears in getFeatures', () => {
    // @ts-expect-error Loose typing acceptable here — runtime spec is what we assert.
    defineFeature(buildFakeFeature('tasks', ['app']))
    expect(getFeatures().map((f) => f.id)).toEqual(['tasks'])
  })

  it('rejects duplicate ids at import time', () => {
    // @ts-expect-error Loose typing acceptable here.
    defineFeature(buildFakeFeature('tasks', ['app']))
    expect(() =>
      // @ts-expect-error Loose typing acceptable here.
      defineFeature(buildFakeFeature('tasks', ['app'])),
    ).toThrow("feature 'tasks' already registered")
  })

  it('filters by surface in getFeaturesForSurface', () => {
    // @ts-expect-error Loose typing acceptable here.
    defineFeature(buildFakeFeature('tasks', ['app']))
    // @ts-expect-error Loose typing acceptable here.
    defineFeature(buildFakeFeature('observations', ['smart', 'embed']))
    expect(getFeaturesForSurface('app').map((f) => f.id)).toEqual(['tasks'])
    expect(getFeaturesForSurface('embed').map((f) => f.id)).toEqual(['observations'])
    expect(getFeaturesForSurface('smart').map((f) => f.id)).toEqual(['observations'])
  })

  it('returns undefined from getFeatureById when id is unknown', () => {
    expect(getFeatureById('missing')).toBeUndefined()
  })

  it('aggregates required scopes across embeddable features', () => {
    // @ts-expect-error Loose typing acceptable here.
    defineFeature(buildFakeFeature('tasks', ['app']))
    // @ts-expect-error Loose typing acceptable here.
    defineFeature(buildFakeFeature('observations', ['embed']))
    // @ts-expect-error Loose typing acceptable here.
    defineFeature(buildFakeFeature('medications', ['smart']))
    expect(getRequiredScopes().toSorted()).toEqual([
      'patient/medications.read',
      'patient/observations.read',
    ])
  })
})
