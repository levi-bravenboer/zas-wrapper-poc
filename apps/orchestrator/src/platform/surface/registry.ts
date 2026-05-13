import type { Surface, SurfaceId } from './types'

export const SURFACES: Readonly<Record<SurfaceId, Surface>> = Object.freeze({
  app: Object.freeze({ id: 'app', data: 'orchestrator', shell: 'menu', basePath: '/' }),
  smart: Object.freeze({ id: 'smart', data: 'fhir', shell: 'menu', basePath: '/s' }),
  embed: Object.freeze({ id: 'embed', data: 'fhir', shell: 'bare', basePath: '/embed' }),
}) as Readonly<Record<SurfaceId, Surface>>
