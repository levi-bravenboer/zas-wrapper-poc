import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createPathway,
  deletePathway,
  getPathway,
  listBlockTypes,
  listPathways,
  listPhaseTemplates,
  replacePathway,
} from './api'
import { pathwayKeys } from './keys'
import type {
  PathwayBlockType,
  PathwayCreate,
  PathwayDefinitionReplace,
  PathwayPhaseTemplate,
  PathwaySummary,
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
    enabled: Boolean(id),
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

export function useDeletePathway() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deletePathway,
    onSuccess: () => {
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
