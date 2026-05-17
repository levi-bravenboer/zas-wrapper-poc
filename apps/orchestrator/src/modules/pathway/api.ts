import { api } from '@/lib/api/client'

import type {
  PathwayBlockType,
  PathwayCreate,
  PathwayDefinitionReplace,
  PathwayEdgeOffsetDirection,
  PathwayEdgeTimingKind,
  PathwayPhaseTemplate,
  PathwaySummary,
  PathwayWithVersion,
} from './types'

function pathwayError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

export async function listPathways(): Promise<PathwaySummary[]> {
  const result = await api.GET('/pathways', {})
  if (!result.data) {
    throw pathwayError('Failed to load pathways', result.response.status)
  }
  return result.data
}

export async function getPathway(id: string): Promise<PathwayWithVersion> {
  const result = await api.GET('/pathways/{pathway_id}', {
    params: { path: { pathway_id: id } },
  })
  if (!result.data) {
    throw pathwayError('Failed to load pathway', result.response.status)
  }
  return result.data
}

export async function createPathway(input: PathwayCreate): Promise<PathwayWithVersion> {
  const result = await api.POST('/pathways', { body: input })
  if (!result.data) {
    throw pathwayError('Failed to create pathway', result.response.status)
  }
  return result.data
}

export async function replacePathway(
  id: string,
  input: PathwayDefinitionReplace,
): Promise<PathwayWithVersion> {
  const result = await api.PUT('/pathways/{pathway_id}', {
    params: { path: { pathway_id: id } },
    body: input,
  })
  if (!result.data) {
    throw pathwayError('Failed to update pathway', result.response.status)
  }
  return result.data
}

export async function deletePathway(id: string): Promise<void> {
  const result = await api.DELETE('/pathways/{pathway_id}', {
    params: { path: { pathway_id: id } },
  })
  if (!result.response.ok) {
    throw pathwayError('Failed to delete pathway', result.response.status)
  }
}

export async function listBlockTypes(): Promise<PathwayBlockType[]> {
  const result = await api.GET('/pathways/blocks', {})
  if (!result.data) {
    throw pathwayError('Failed to load block catalogue', result.response.status)
  }
  return result.data
}

export async function listPhaseTemplates(): Promise<PathwayPhaseTemplate[]> {
  const result = await api.GET('/pathways/phase-templates', {})
  if (!result.data) {
    throw pathwayError('Failed to load phase templates', result.response.status)
  }
  return result.data
}

export async function listEdgeTimingKinds(): Promise<PathwayEdgeTimingKind[]> {
  const result = await api.GET('/pathways/edge-timing-kinds', {})
  if (!result.data) {
    throw pathwayError('Failed to load edge timing kinds', result.response.status)
  }
  return result.data
}

export async function listEdgeOffsetDirections(): Promise<PathwayEdgeOffsetDirection[]> {
  const result = await api.GET('/pathways/edge-offset-directions', {})
  if (!result.data) {
    throw pathwayError('Failed to load edge offset directions', result.response.status)
  }
  return result.data
}
