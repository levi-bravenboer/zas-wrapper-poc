import { Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sortByOrd } from '@/lib/utils/ordinal'

import { BlockTypeIcon } from '../../blockCatalogue'
import { CONFIG_SCHEMAS, defaultConfig } from '../../configSchemas'
import {
  legacyBlockConfig,
  type BlockConfig,
  type PathwayBlock,
  type PathwayBlockBranch,
  type PathwayBlockType,
  type PathwayLane,
  type PathwayPhase,
} from '../../types'
import { isLaneAllowed } from '../../utils/laneRules'
import { InspectorSwitch } from '../drawer/InspectorSwitch'

import { InputLogicEditor } from './InputLogicEditor'
import { TimingPolicyEditor, type TimingPolicyValue } from './TimingPolicyEditor'

type InputLogicShape = NonNullable<PathwayBlock['input_logic']>

export type BlockDraft = {
  name: string
  phaseId: string
  laneId: string
  config: BlockConfig
  inputLogic: InputLogicShape
  timingPolicy: TimingPolicyValue
}

type Props = {
  open: boolean
  mode: 'add' | 'edit'
  blockType: PathwayBlockType
  /** Edit mode: the block being edited. Add mode: null. */
  block: PathwayBlock | null
  phases: PathwayPhase[]
  /** FULL lane list — the picker filters on the kind's allowed lane kinds. */
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  branches: PathwayBlockBranch[]
  currentPathwayId: string
  onSubmit: (draft: BlockDraft) => void
  onDelete?: (() => void) | undefined
  onClose: () => void
}

const EMPTY_LOGIC: InputLogicShape = { rules: [], aggregator: 'all_of' }

function initialDraft(
  mode: 'add' | 'edit',
  blockType: PathwayBlockType,
  block: PathwayBlock | null,
  phases: PathwayPhase[],
  allowedLanes: PathwayLane[],
): BlockDraft {
  if (mode === 'edit' && block) {
    return {
      name: block.name,
      phaseId: block.phase_id,
      laneId: block.lane_id,
      config: legacyBlockConfig(block),
      inputLogic: block.input_logic ?? EMPTY_LOGIC,
      timingPolicy: block.timing_policy ?? null,
    }
  }
  return {
    name: '',
    phaseId: sortByOrd(phases)[0]?.id ?? '',
    laneId: allowedLanes[0]?.id ?? '',
    config: defaultConfig(blockType.semantics) as BlockConfig,
    inputLogic: EMPTY_LOGIC,
    timingPolicy: null,
  }
}

// Pathway-completion § C4: THE authoring surface. Title + phase picker
// + per-kind config + input_logic rule composer + timing_policy editor
// (hidden where the publish gate forbids timing). The lane is derived
// from the kind's allowed lane kinds — no picker (user decision,
// 2026-06-12); the first allowed lane wins for multi-kind blocks.
// Submit applies the whole draft in one dispatch; cancel leaves the
// version untouched.
export function BlockDialog({
  open,
  mode,
  blockType,
  block,
  phases,
  lanes,
  blocks,
  branches,
  currentPathwayId,
  onSubmit,
  onDelete,
  onClose,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')

  const allowedLanes = useMemo(
    () => lanes.filter((lane) => isLaneAllowed(blockType, lane.lane_kind_code)),
    [lanes, blockType],
  )

  const [draft, setDraft] = useState<BlockDraft>(() =>
    initialDraft(mode, blockType, block, phases, allowedLanes),
  )

  const typeLabel = t(`blockType.${blockType.type}`, { defaultValue: blockType.label })
  const typeDescription = t(`blockTypeDescription.${blockType.type}`, { defaultValue: '' })

  // input_logic is forbidden on `start` (fires at enrollment t=0).
  const logicAllowed = blockType.semantics !== 'start'

  // timing_policy is forbidden where the publish gate rejects it:
  // start / end_pathway fire on lifecycle moments; informed_consent
  // owns its timing via the reminder/expiry fields.
  const timingAllowed = !['start', 'end_pathway', 'informed_consent'].includes(
    blockType.semantics,
  )

  const upstreamBlocks = useMemo(
    () => blocks.filter((b) => b.id !== block?.id),
    [blocks, block?.id],
  )

  const parsed = useMemo(
    () => CONFIG_SCHEMAS[blockType.semantics].safeParse(draft.config),
    [blockType.semantics, draft.config],
  )

  // Stub envelope so InspectorSwitch consumers that read block identity
  // (e.g. WaitInspector's self-exclusion) behave in add mode too.
  const inspectorBlock = (block ?? {
    id: 'draft',
    phase_id: draft.phaseId,
    lane_id: draft.laneId,
    name: draft.name,
    input_logic: draft.inputLogic,
    timing_policy: null,
    x: 0,
    y: 0,
  }) as PathwayBlock

  const canSubmit = draft.phaseId !== '' && draft.laneId !== '' && parsed.success

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b px-5 py-4" style={{ borderColor: 'var(--hairline)' }}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BlockTypeIcon icon={blockType.icon} className="size-5" strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[15px]">
                {mode === 'add'
                  ? t('blockDialog.addTitle', {
                      defaultValue: 'Nieuw blok — {{type}}',
                      type: typeLabel,
                    })
                  : t('blockDialog.editTitle', {
                      defaultValue: 'Blok bewerken — {{type}}',
                      type: typeLabel,
                    })}
              </DialogTitle>
              {typeDescription && (
                <DialogDescription className="text-[12px]">{typeDescription}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            {blockType.semantics !== 'end_pathway' && (
              <div>
                <label
                  htmlFor="block-dialog-name"
                  className="mb-1 block text-[12px] font-medium text-foreground"
                >
                  {t('blockDialog.name', { defaultValue: 'Naam' })}
                </label>
                <Input
                  id="block-dialog-name"
                  value={draft.name}
                  placeholder={typeLabel}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
            )}
            <div>
              <label
                htmlFor="block-dialog-phase"
                className="mb-1 block text-[12px] font-medium text-foreground"
              >
                {t('blockDialog.phase', { defaultValue: 'Fase' })}
              </label>
              <Select
                value={draft.phaseId}
                onValueChange={(phaseId) => setDraft({ ...draft, phaseId })}
              >
                <SelectTrigger id="block-dialog-phase">
                  <SelectValue
                    placeholder={t('blockDialog.phasePlaceholder', {
                      defaultValue: 'Kies fase',
                    })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sortByOrd(phases).map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-2 rounded-md border bg-muted/20 p-3">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('blockDialog.configHeader', { defaultValue: 'Blok-instellingen' })}
            </h3>
            {parsed.success ? (
              <InspectorSwitch
                blockType={blockType}
                block={inspectorBlock}
                data={parsed.data}
                blocks={blocks}
                branches={branches}
                currentPathwayId={currentPathwayId}
                onPatchConfig={(config) => setDraft({ ...draft, config })}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({ ...draft, config: defaultConfig(blockType.semantics) as BlockConfig })
                }
              >
                {t('drawer.parseError.reset')}
              </Button>
            )}
          </section>

          {logicAllowed && (
            <section className="space-y-2 rounded-md border bg-muted/20 p-3">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('blockDialog.logicHeader', { defaultValue: 'Bedrijfslogica' })}
              </h3>
              <InputLogicEditor
                value={draft.inputLogic}
                upstreamBlocks={upstreamBlocks}
                onChange={(inputLogic) => setDraft({ ...draft, inputLogic })}
              />
            </section>
          )}

          {timingAllowed && (
            <section className="space-y-2 rounded-md border bg-muted/20 p-3">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('blockDialog.timingHeader', { defaultValue: 'Timing' })}
              </h3>
              <TimingPolicyEditor
                value={draft.timingPolicy}
                onChange={(timingPolicy) => setDraft({ ...draft, timingPolicy })}
              />
            </section>
          )}
        </div>

        <DialogFooter
          className="flex-row items-center border-t px-5 py-3"
          style={{ borderColor: 'var(--hairline)' }}
        >
          {mode === 'edit' &&
            onDelete &&
            blockType.semantics !== 'start' &&
            blockType.semantics !== 'end_pathway' && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {t('drawer.delete')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t('blockDialog.cancel', { defaultValue: 'Annuleren' })}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => onSubmit(draft)}>
            {mode === 'add'
              ? t('blockDialog.add', { defaultValue: 'Voeg toe' })
              : t('blockDialog.save', { defaultValue: 'Opslaan' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
