import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { SaveState } from '../components/topbar/SaveStatusPill'
import { useReplacePathway } from '../hooks'
import type { PathwayBare, PathwayVersionDefinition } from '../types'
import type { BuilderAction } from '../useBuilderState'

const AUTOSAVE_DEBOUNCE_MS = 800

type Options = {
  pathway: PathwayBare
  version: PathwayVersionDefinition
  dispatch: (action: BuilderAction) => void
  isDirty: boolean
}

type AutosaveHandlers = {
  saveState: SaveState
  flush: () => void
  onRename: (name: string) => void
}

function buildPayload(pathway: PathwayBare, version: PathwayVersionDefinition) {
  return {
    name: pathway.name,
    clinical_goal: pathway.clinical_goal ?? null,
    patient_goal: pathway.patient_goal ?? null,
    phases: version.phases ?? [],
    lanes: (version.lanes ?? []).map((l) => ({
      id: l.id,
      lane_kind_code: l.lane_kind_code,
      label: l.label,
      ord: l.ord,
      is_default: l.is_default,
      height_px: l.height_px ?? 180,
    })),
    timing_values: (version.timing_values ?? []).map((tv) => ({ ...tv })),
    blocks: (version.blocks ?? []).map((b) => ({
      id: b.id,
      phase_id: b.phase_id,
      lane_id: b.lane_id,
      type: b.type,
      label: b.label ?? null,
      duration_value_id: b.duration_value_id ?? null,
      config: b.config ?? {},
      x: b.x,
      y: b.y,
    })),
    branches: (version.branches ?? []).map((br) => ({ ...br })),
    edges: (version.edges ?? []).map((e) => ({ ...e })),
    time_markers: (version.time_markers ?? []).map((tm) => ({ ...tm })),
    deferred_fields: (version.deferred_fields ?? []).map((df) => ({ ...df })),
  }
}

export function useAutosavePathway({
  pathway,
  version,
  dispatch,
  isDirty,
}: Options): AutosaveHandlers {
  const { t } = useTranslation('pathway')
  const replace = useReplacePathway(pathway.id)

  const saveState: SaveState = replace.isPending
    ? 'saving'
    : replace.isError
      ? 'error'
      : isDirty
        ? 'dirty'
        : 'clean'

  // Holds the last version reference that failed to save. Autosave skips
  // re-attempts while the version reference is unchanged, so an unrecoverable
  // payload doesn't loop the PUT every 800ms. A fresh edit changes the
  // reference and unlocks the next retry.
  const lastErroredVersion = useRef<PathwayVersionDefinition | null>(null)

  const performSave = useCallback(
    (p: PathwayBare, v: PathwayVersionDefinition) => {
      replace.mutate(buildPayload(p, v), {
        onSuccess: (next) => {
          lastErroredVersion.current = null
          dispatch({ type: 'reset', version: next.version })
        },
        onError: () => {
          lastErroredVersion.current = v
          toast.error(t('save.error'))
        },
      })
    },
    [replace, dispatch, t],
  )

  const flush = useCallback(() => {
    if (isDirty && !replace.isPending) performSave(pathway, version)
  }, [isDirty, replace.isPending, performSave, pathway, version])

  useEffect(() => {
    if (!isDirty || replace.isPending) return
    if (lastErroredVersion.current === version) return
    const id = setTimeout(() => performSave(pathway, version), AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [isDirty, replace.isPending, performSave, pathway, version])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('visibilitychange', onVisibility)
    return () => window.removeEventListener('visibilitychange', onVisibility)
  }, [flush])

  const onRename = useCallback(
    (name: string) => {
      replace.mutate(
        { ...buildPayload(pathway, version), name },
        {
          onSuccess: (next) => dispatch({ type: 'reset', version: next.version }),
          onError: () => toast.error(t('save.error')),
        },
      )
    },
    [pathway, version, replace, dispatch, t],
  )

  return { saveState, flush, onRename }
}
