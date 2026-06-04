import { api } from '@/lib/api/client'

import type {
  PathwayBlockType,
  PathwayChildSummary,
  PathwayCreate,
  PathwayDefinitionReplace,
  PathwayDuplicateRequest,
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

type PathwayApiError = Error & { status: number; code?: string }

function pathwayError(message: string, status: number, code?: string): PathwayApiError {
  const err = new Error(message) as PathwayApiError
  err.status = status
  if (code) err.code = code
  return err
}

function errorFromResponse(
  fallbackMessage: string,
  status: number,
  body: unknown,
): PathwayApiError {
  if (body && typeof body === 'object' && 'code' in body) {
    const b = body as { code?: string; message?: string }
    return pathwayError(b.message ?? fallbackMessage, status, b.code)
  }
  return pathwayError(fallbackMessage, status)
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

export async function listPathwayParentReferences(id: string): Promise<PathwayParentReference[]> {
  const result = await api.GET('/pathways/{pathway_id}/parent-references', {
    params: { path: { pathway_id: id } },
  })
  if (!result.data) {
    throw pathwayError('Failed to load parent references', result.response.status)
  }
  return result.data
}

export type DeletePathwayResult = { ok: true } | { ok: false; referrers: PathwayParentReference[] }

export async function deletePathway(id: string): Promise<DeletePathwayResult> {
  const result = await api.DELETE('/pathways/{pathway_id}', {
    params: { path: { pathway_id: id } },
  })
  if (result.response.status === 204) return { ok: true }
  const error = (result as { error?: unknown }).error as
    | { code?: string; details?: { referrers?: PathwayParentReference[] } }
    | undefined
  if (result.response.status === 409 && error?.code === 'conflict.pathway.has-referrers') {
    return { ok: false, referrers: error.details?.referrers ?? [] }
  }
  throw errorFromResponse('Failed to delete pathway', result.response.status, error)
}

export async function getPathwaySummary(id: string): Promise<PathwayChildSummary> {
  const result = await api.GET('/pathways/{pathway_id}/summary', {
    params: { path: { pathway_id: id } },
  })
  if (!result.data) {
    throw pathwayError('Failed to load pathway summary', result.response.status)
  }
  return result.data
}

export async function listPathwayVersions(pathwayId: string): Promise<PathwayVersionSummary[]> {
  const result = await api.GET('/pathways/{pathway_id}/versions', {
    params: { path: { pathway_id: pathwayId } },
  })
  if (!result.data) {
    throw pathwayError('Failed to load versions', result.response.status)
  }
  return result.data
}

export async function getPathwayVersion(
  pathwayId: string,
  versionId: string,
): Promise<PathwayVersionDefinition> {
  const result = await api.GET('/pathways/{pathway_id}/versions/{version_id}', {
    params: { path: { pathway_id: pathwayId, version_id: versionId } },
  })
  if (!result.data) {
    throw pathwayError('Failed to load version', result.response.status)
  }
  return result.data
}

export async function publishPathway(
  pathwayId: string,
  payload: PathwayPublishRequest,
): Promise<PathwayVersionSummary> {
  const result = await api.POST('/pathways/{pathway_id}/publish', {
    params: { path: { pathway_id: pathwayId } },
    body: payload,
  })
  if (!result.data) {
    throw errorFromResponse('Failed to publish pathway', result.response.status, result.error)
  }
  return result.data
}

export async function restorePathwayVersion(
  pathwayId: string,
  versionId: string,
): Promise<PathwayVersionSummary> {
  const result = await api.POST('/pathways/{pathway_id}/versions/{version_id}/restore', {
    params: { path: { pathway_id: pathwayId, version_id: versionId } },
  })
  if (!result.data) {
    throw errorFromResponse('Failed to restore version', result.response.status, result.error)
  }
  return result.data
}

export async function duplicatePathway(
  pathwayId: string,
  body: PathwayDuplicateRequest,
): Promise<PathwaySummary> {
  const result = await api.POST('/pathways/{pathway_id}/duplicate', {
    params: { path: { pathway_id: pathwayId } },
    body,
  })
  if (!result.data) {
    throw errorFromResponse('Failed to duplicate pathway', result.response.status, result.error)
  }
  return result.data
}

export async function forkPathwayFromPublish(
  pathwayId: string,
  versionId: string,
): Promise<PathwayVersionSummary> {
  const result = await api.POST('/pathways/{pathway_id}/versions/{version_id}/fork-from-publish', {
    params: { path: { pathway_id: pathwayId, version_id: versionId } },
  })
  if (!result.data) {
    throw errorFromResponse('Failed to fork version', result.response.status, result.error)
  }
  return result.data
}
