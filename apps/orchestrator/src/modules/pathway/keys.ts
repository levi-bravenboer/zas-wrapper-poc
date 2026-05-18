export const pathwayKeys = {
  all: ['pathway'] as const,
  list: () => ['pathway', 'list'] as const,
  detail: (id: string) => ['pathway', 'detail', id] as const,
  blocks: () => ['pathway', 'blocks'] as const,
  phaseTemplates: () => ['pathway', 'phase-templates'] as const,
  edgeTimingKinds: () => ['pathway', 'edge-timing-kinds'] as const,
  edgeOffsetDirections: () => ['pathway', 'edge-offset-directions'] as const,
  versions: (id: string) => ['pathway', 'versions', id] as const,
  version: (id: string, versionId: string) => ['pathway', 'versions', id, versionId] as const,
}
