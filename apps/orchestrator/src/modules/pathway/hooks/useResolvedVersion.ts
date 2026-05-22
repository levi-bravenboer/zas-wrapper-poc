import { usePathway, usePathwayVersion } from '../hooks'
import type { PathwayBare, PathwayVersionDefinition } from '../types'

export type ReadOnlyVariant = 'historical' | 'published-fallback'

type ResolvedVersionState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; error: Error; refetch: () => void }
  | {
      status: 'ready'
      pathway: PathwayBare
      version: PathwayVersionDefinition
      isReadOnly: boolean
      readOnlyVariant: ReadOnlyVariant | null
    }

type ApiError = Error & { status?: number }

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as ApiError).status
  }
  return undefined
}

export function useResolvedVersion(
  pathwayId: string,
  versionId: string | undefined,
): ResolvedVersionState {
  const pathwayQuery = usePathway(pathwayId)
  const versionQuery = usePathwayVersion(pathwayId, versionId)

  if (pathwayQuery.isLoading) return { status: 'loading' }
  if (pathwayQuery.isError) {
    if (statusOf(pathwayQuery.error) === 404) return { status: 'not-found' }
    return {
      status: 'error',
      error: pathwayQuery.error instanceof Error ? pathwayQuery.error : new Error('Unknown error'),
      refetch: () => {
        void pathwayQuery.refetch()
      },
    }
  }
  if (!pathwayQuery.data) return { status: 'loading' }

  if (versionId) {
    if (versionQuery.isLoading) return { status: 'loading' }
    if (versionQuery.isError) {
      if (statusOf(versionQuery.error) === 404) return { status: 'not-found' }
      return {
        status: 'error',
        error:
          versionQuery.error instanceof Error ? versionQuery.error : new Error('Unknown error'),
        refetch: () => {
          void versionQuery.refetch()
        },
      }
    }
    if (!versionQuery.data) return { status: 'loading' }

    const version = versionQuery.data
    return {
      status: 'ready',
      pathway: pathwayQuery.data.pathway,
      version,
      isReadOnly: true,
      readOnlyVariant: 'historical',
    }
  }

  const { pathway, version } = pathwayQuery.data
  const isReadOnly = version.status !== 'concept'
  const readOnlyVariant: ReadOnlyVariant | null = isReadOnly ? 'published-fallback' : null

  return {
    status: 'ready',
    pathway,
    version,
    isReadOnly,
    readOnlyVariant,
  }
}
