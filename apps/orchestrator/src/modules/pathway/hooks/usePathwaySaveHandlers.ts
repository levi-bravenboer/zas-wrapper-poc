import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { SaveState } from '../components/topbar/SaveStatusPill'
import { useReplacePathway } from '../hooks'
import type { PathwayBare, PathwayVersionDefinition } from '../types'
import type { BuilderAction } from '../useBuilderState'

type Options = {
  pathway: PathwayBare
  version: PathwayVersionDefinition
  dispatch: (action: BuilderAction) => void
  isDirty: boolean
}

type SaveHandlers = {
  saveState: SaveState
  onSave: () => void
  onRename: (name: string) => void
}

export function usePathwaySaveHandlers({
  pathway,
  version,
  dispatch,
  isDirty,
}: Options): SaveHandlers {
  const { t } = useTranslation('pathway')
  const replace = useReplacePathway(pathway.id)

  const saveState: SaveState = replace.isPending
    ? 'saving'
    : replace.isError
      ? 'error'
      : isDirty
        ? 'dirty'
        : 'clean'

  const onSave = useCallback(() => {
    replace.mutate(
      {
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
      },
      {
        onSuccess: (next) => {
          dispatch({ type: 'reset', version: next.version })
          toast.success(t('save.success'))
        },
        onError: () => {
          toast.error(t('save.error'))
        },
      },
    )
  }, [version, pathway, replace, dispatch, t])

  const onRename = useCallback(
    (name: string) => {
      replace.mutate(
        {
          name,
          clinical_goal: pathway.clinical_goal ?? null,
          patient_goal: pathway.patient_goal ?? null,
        },
        {
          onError: () => toast.error(t('save.error')),
        },
      )
    },
    [pathway, replace, t],
  )

  return { saveState, onSave, onRename }
}
