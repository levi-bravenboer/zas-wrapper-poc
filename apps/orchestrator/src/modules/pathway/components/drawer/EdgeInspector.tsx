import { Trash2, X } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { formatTimingDelay } from '../../formatTiming'
import { readEdgeTiming } from '../../types'
import type {
  EdgeTimingKindCode,
  PathwayBlock,
  PathwayBlockBranch,
  PathwayEdge,
  PathwayEdgeOffsetDirection,
  PathwayEdgeTimingKind,
  PathwayTimeMarker,
  PathwayTimingValue,
} from '../../types'

import { InspectorField } from './inspectors/InspectorField'

type TimingPatchKey =
  | 'delay_value_id'
  | 'time_marker_id'
  | 'offset_value_id'
  | 'offset_direction_code'
  | 'source_branch_id'

type Props = {
  edge: PathwayEdge
  timingKinds: PathwayEdgeTimingKind[]
  offsetDirections: PathwayEdgeOffsetDirection[]
  timingValues: PathwayTimingValue[]
  timeMarkers: PathwayTimeMarker[]
  blocks: PathwayBlock[]
  branches: PathwayBlockBranch[]
  onPatchEdge: (patch: Partial<PathwayEdge>) => void
  onDelete: () => void
  onClose: () => void
}

function timingValueLabel(v: PathwayTimingValue): string {
  if (v.kind === 'enrollment') return 'Enrollment +0d'
  return formatTimingDelay(v) ?? v.id
}

function clearedTimingPatch(): Pick<PathwayEdge, TimingPatchKey> {
  return {
    delay_value_id: null,
    time_marker_id: null,
    offset_value_id: null,
    offset_direction_code: null,
    source_branch_id: null,
  }
}

export function EdgeInspector({
  edge,
  timingKinds,
  offsetDirections,
  timingValues,
  timeMarkers,
  blocks,
  branches,
  onPatchEdge,
  onDelete,
  onClose,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const currentKind = readEdgeTiming(edge).kind

  const sourceBlock = useMemo(
    () => blocks.find((b) => b.id === edge.source_block_id) ?? null,
    [blocks, edge.source_block_id],
  )
  const sourceBlockBranches = useMemo(
    () => branches.filter((b) => b.block_id === edge.source_block_id),
    [branches, edge.source_block_id],
  )

  const orderedKinds: EdgeTimingKindCode[] =
    timingKinds.length > 0
      ? timingKinds.map((k) => k.kind)
      : ['completion', 'marker', 'immediate', 'branch']

  function switchToKind(kind: EdgeTimingKindCode) {
    if (kind === currentKind) return
    if (kind === 'immediate') {
      onPatchEdge(clearedTimingPatch())
      return
    }
    // For completion/marker/branch we only flip kind once user picks the
    // mandatory field — keep current edge state until then.
    // Exception: branch with zero branches stays no-op.
    // We do nothing here; the per-kind sub-form drives the patch when complete.
    // But we still want the UI to show the kind picker as "active". For that
    // we keep `currentKind` derived from edge; switching kind without a value
    // is purely visual via the segmented button until the sub-form dispatches.
    // → emit a "soft" patch that nulls the OTHER kinds' fields so the kind
    // picker reflects the new selection. The new kind's fields stay empty
    // until the sub-form picks them.
    const cleared = clearedTimingPatch()
    // For branch kind, if there's exactly one branch we can pre-select it.
    if (kind === 'branch') {
      const only = sourceBlockBranches.at(0)
      if (only) {
        onPatchEdge({ ...cleared, source_branch_id: only.id })
        return
      }
    }
    onPatchEdge(cleared)
  }

  function pickCompletion(valueId: string) {
    onPatchEdge({ ...clearedTimingPatch(), delay_value_id: valueId })
  }

  function pickMarker(markerId: string) {
    onPatchEdge({ ...clearedTimingPatch(), time_marker_id: markerId })
  }

  function pickOffsetValue(valueId: string) {
    onPatchEdge({ offset_value_id: valueId })
  }

  function pickOffsetDirection(code: string) {
    onPatchEdge({ offset_direction_code: code })
  }

  function pickBranch(branchId: string) {
    onPatchEdge({ ...clearedTimingPatch(), source_branch_id: branchId })
  }

  return (
    <aside
      data-slot="edge-inspector"
      className="absolute inset-y-0 right-0 z-20 flex w-[360px] flex-col gap-3 border-l bg-white/95 shadow-xl backdrop-blur-md"
      style={{ borderLeftColor: 'var(--hairline)' }}
    >
      <header
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderBottomColor: 'var(--hairline)' }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-semibold tracking-tight text-foreground">
            {t('drawer.edgeTitle')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {sourceBlock?.label ?? sourceBlock?.type ?? '—'}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('drawer.close')}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('drawer.edgeKindHeader')}
        </h3>

        <div role="tablist" aria-label={t('drawer.edgeKindHeader')} className="mb-4 grid grid-cols-2 gap-1.5">
          {orderedKinds.map((kind) => (
            <Button
              key={kind}
              type="button"
              role="tab"
              aria-selected={kind === currentKind}
              variant={kind === currentKind ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchToKind(kind)}
            >
              {t(`inspector.edge.kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)}
            </Button>
          ))}
        </div>

        {currentKind === 'completion' && (
          <InspectorField label={t('inspector.edge.delayValue')}>
            <Select value={edge.delay_value_id ?? ''} onValueChange={pickCompletion}>
              <SelectTrigger>
                <SelectValue placeholder={t('inspector.edge.delayValuePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {timingValues.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t('inspector.edge.noTimingValues')}
                  </div>
                ) : (
                  timingValues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {timingValueLabel(v)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </InspectorField>
        )}

        {currentKind === 'marker' && (
          <div className="flex flex-col gap-3">
            <InspectorField label={t('inspector.edge.marker')}>
              <Select value={edge.time_marker_id ?? ''} onValueChange={pickMarker}>
                <SelectTrigger>
                  <SelectValue placeholder={t('inspector.edge.markerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {timeMarkers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t('inspector.edge.noMarkers')}
                    </div>
                  ) : (
                    timeMarkers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </InspectorField>

            <InspectorField label={t('inspector.edge.offsetValue')}>
              <Select value={edge.offset_value_id ?? ''} onValueChange={pickOffsetValue}>
                <SelectTrigger>
                  <SelectValue placeholder={t('inspector.edge.offsetValuePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {timingValues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {timingValueLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InspectorField>

            <InspectorField label={t('inspector.edge.offsetDirection')}>
              <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
                {offsetDirections.map((d) => (
                  <Button
                    key={d.code}
                    type="button"
                    role="radio"
                    aria-checked={edge.offset_direction_code === d.code}
                    variant={edge.offset_direction_code === d.code ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => pickOffsetDirection(d.code)}
                  >
                    {t(`edgeOffsetDirection.${d.code}`, { defaultValue: d.label })}
                  </Button>
                ))}
              </div>
            </InspectorField>
          </div>
        )}

        {currentKind === 'immediate' && (
          <p className="text-xs text-muted-foreground">{t('inspector.edge.immediateHint')}</p>
        )}

        {currentKind === 'branch' && (
          <InspectorField label={t('inspector.edge.branch')}>
            <Select
              value={edge.source_branch_id ?? ''}
              onValueChange={pickBranch}
              disabled={sourceBlockBranches.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('inspector.edge.branchPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {sourceBlockBranches.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t('inspector.edge.noBranches')}
                  </div>
                ) : (
                  sourceBlockBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </InspectorField>
        )}
      </div>

      <footer
        className="flex items-center justify-between border-t px-4 py-3"
        style={{ borderTopColor: 'var(--hairline)' }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
          {t('inspector.edge.delete')}
        </Button>
        <Button type="button" onClick={onClose}>
          {t('drawer.done')}
        </Button>
      </footer>
    </aside>
  )
}
