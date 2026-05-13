export type DataSource = 'orchestrator' | 'fhir'
export type Shell = 'menu' | 'bare'
export type SurfaceId = 'app' | 'smart' | 'embed'

export type Surface = {
  readonly id: SurfaceId
  readonly data: DataSource
  readonly shell: Shell
  readonly basePath: string
}
