import type { PathwayBlockType } from '../../types'

export type CatalogueGroup =
  | { source: 'native'; items: PathwayBlockType[] }
  | { source: 'external'; provider: string; items: PathwayBlockType[] }

/** Bucket the catalogue into one native group followed by one external group
 * per provider. Preserves the catalogue's intrinsic order inside each bucket
 * so the dock stays stable. External entries missing a provider fall back to
 * the literal string `'unknown'` so they remain renderable but visibly odd. */
export function groupCatalogueBySource(catalogue: PathwayBlockType[]): CatalogueGroup[] {
  const native: PathwayBlockType[] = []
  const byProvider = new Map<string, PathwayBlockType[]>()

  for (const entry of catalogue) {
    if (entry.source === 'external') {
      const provider = entry.provider ?? 'unknown'
      const bucket = byProvider.get(provider) ?? []
      bucket.push(entry)
      byProvider.set(provider, bucket)
    } else {
      native.push(entry)
    }
  }

  const groups: CatalogueGroup[] = []
  if (native.length > 0) groups.push({ source: 'native', items: native })
  for (const [provider, items] of byProvider) {
    groups.push({ source: 'external', provider, items })
  }
  return groups
}
