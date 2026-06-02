import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type DeletePathwayResult,
  createPathway,
  deletePathway,
  forkPathwayFromPublish,
  getPathway,
  getPathwayVersion,
  listBlockTypes,
  listEdgeOffsetDirections,
  listEdgeTimingKinds,
  listPathwayParentReferences,
  listPathwayVersions,
  listPathways,
  listPhaseTemplates,
  publishPathway,
  replacePathway,
  restorePathwayVersion,
} from './api'
import { pathwayKeys } from './keys'
import type {
  PathwayBlockType,
  PathwayCreate,
  PathwayDefinitionReplace,
  PathwayEdgeOffsetDirection,
  PathwayEdgeTimingKind,
  PathwayParentReference,
  PathwayPhaseTemplate,
  PathwayPublishRequest,
  PathwaySummary,
  PathwayVersionDefinition,
  PathwayVersionSummary,
  PathwayWithVersion,
} from './types'

export function usePathwayList() {
  return useQuery<PathwaySummary[]>({
    queryKey: pathwayKeys.list(),
    queryFn: listPathways,
  })
}

export function usePathway(id: string | undefined) {
  return useQuery<PathwayWithVersion>({
    queryKey: id ? pathwayKeys.detail(id) : pathwayKeys.detail('__none__'),
    queryFn: () => getPathway(id as string),
    enabled: !!id,
  })
}

export function useCreatePathway() {
  const qc = useQueryClient()
  return useMutation<PathwayWithVersion, Error, PathwayCreate>({
    mutationFn: createPathway,
    onSuccess: (data) => {
      qc.setQueryData(pathwayKeys.detail(data.pathway.id), data)
      void qc.invalidateQueries({ queryKey: pathwayKeys.list() })
    },
  })
}

export function useParentReferences(id: string | undefined) {
  return useQuery<PathwayParentReference[]>({
    queryKey: id ? pathwayKeys.parentReferences(id) : pathwayKeys.parentReferences('__none__'),
    queryFn: () => listPathwayParentReferences(id as string),
    enabled: !!id,
  })
}

export function useDeletePathway() {
  const qc = useQueryClient()
  return useMutation<DeletePathwayResult, Error, string>({
    mutationFn: (id) => deletePathway(id),
    onSuccess: (result, id) => {
      if (result.ok) {
        qc.removeQueries({ queryKey: pathwayKeys.detail(id) })
        void qc.invalidateQueries({ queryKey: pathwayKeys.list() })
      }
    },
  })
}

export function useReplacePathway(id: string) {
  const qc = useQueryClient()
  return useMutation<PathwayWithVersion, Error, PathwayDefinitionReplace>({
    mutationFn: (payload) => replacePathway(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(pathwayKeys.detail(id), data)
      void qc.invalidateQueries({ queryKey: pathwayKeys.list() })
    },
  })
}

export function usePathwayBlocks() {
  return useQuery<PathwayBlockType[]>({
    queryKey: pathwayKeys.blocks(),
    queryFn: listBlockTypes,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function usePathwayPhaseTemplates() {
  return useQuery<PathwayPhaseTemplate[]>({
    queryKey: pathwayKeys.phaseTemplates(),
    queryFn: listPhaseTemplates,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useEdgeTimingKinds() {
  return useQuery<PathwayEdgeTimingKind[]>({
    queryKey: pathwayKeys.edgeTimingKinds(),
    queryFn: listEdgeTimingKinds,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useEdgeOffsetDirections() {
  return useQuery<PathwayEdgeOffsetDirection[]>({
    queryKey: pathwayKeys.edgeOffsetDirections(),
    queryFn: listEdgeOffsetDirections,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function usePathwayVersions(pathwayId: string | undefined) {
  return useQuery<PathwayVersionSummary[]>({
    queryKey: pathwayId ? pathwayKeys.versions(pathwayId) : pathwayKeys.versions('__none__'),
    queryFn: () => listPathwayVersions(pathwayId as string),
    enabled: !!pathwayId,
  })
}

export function usePathwayVersion(pathwayId: string | undefined, versionId: string | undefined) {
  return useQuery<PathwayVersionDefinition>({
    queryKey:
      pathwayId && versionId
        ? pathwayKeys.version(pathwayId, versionId)
        : pathwayKeys.version('__none__', '__none__'),
    queryFn: () => getPathwayVersion(pathwayId as string, versionId as string),
    enabled: !!pathwayId && !!versionId,
  })
}

function invalidatePathway(qc: ReturnType<typeof useQueryClient>, pathwayId: string) {
  void qc.invalidateQueries({ queryKey: pathwayKeys.detail(pathwayId) })
  void qc.invalidateQueries({ queryKey: pathwayKeys.versions(pathwayId) })
  void qc.invalidateQueries({ queryKey: pathwayKeys.list() })
}

export function usePublishPathway(pathwayId: string) {
  const qc = useQueryClient()
  return useMutation<PathwayVersionSummary, Error, PathwayPublishRequest>({
    mutationFn: (payload) => publishPathway(pathwayId, payload),
    onSuccess: () => invalidatePathway(qc, pathwayId),
  })
}

export function useRestorePathwayVersion(pathwayId: string) {
  const qc = useQueryClient()
  return useMutation<PathwayVersionSummary, Error, { versionId: string }>({
    mutationFn: ({ versionId }) => restorePathwayVersion(pathwayId, versionId),
    onSuccess: () => invalidatePathway(qc, pathwayId),
  })
}

export function useForkPathwayFromPublish(pathwayId: string) {
  const qc = useQueryClient()
  return useMutation<PathwayVersionSummary, Error, { versionId: string }>({
    mutationFn: ({ versionId }) => forkPathwayFromPublish(pathwayId, versionId),
    onSuccess: () => invalidatePathway(qc, pathwayId),
  })
}
