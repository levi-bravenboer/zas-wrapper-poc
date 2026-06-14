import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { BlockTypeIcon } from '../../blockCatalogue'
import { defaultConfig } from '../../configSchemas'
import { useBlockDraft, type BlockDraft } from '../../hooks/useBlockDraft'
import {
  type BlockConfig,
  type PathwayBlock,
  type PathwayBlockBranch,
  type PathwayBlockType,
  type PathwayLane,
  type PathwayPhase,
} from '../../types'
import { getBlockEditingFeatures } from '../../utils/blockEditingFeatures'
import { InspectorSwitch } from '../drawer/InspectorSwitch'

import { BlockDialogFooter } from './BlockDialogFooter'
import { BlockIdentityFields } from './BlockIdentityFields'
import { InputLogicEditor } from './InputLogicEditor'
import { TimingPolicyEditor } from './TimingPolicyEditor'

export type { BlockDraft } from '../../hooks/useBlockDraft'

type Props = {
  open: boolean
  mode: 'add' | 'edit'
  blockType: PathwayBlockType
  /** Edit mode: the block being edited. Add mode: null. */
  block: PathwayBlock | null
  phases: PathwayPhase[]
  /** Full lane list — the dialog derives the block's lane from
   * `blockType.allowed_lane_kind_codes` (first match wins; no picker). */
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  branches: PathwayBlockBranch[]
  currentPathwayId: string
  onSubmit: (draft: BlockDraft) => void
  onDelete?: (() => void) | undefined
  onClose: () => void
}

// Pathway-completion § C4: THE authoring surface. Title + phase
// picker + per-kind config + input_logic rule composer +
// timing_policy editor. Per-kind rules (which sections show, whether
// the block is deletable, whether it carries a name) live in
// `getBlockEditingFeatures`. State + parsed-config + canSubmit live
// in `useBlockDraft`. Submit applies the whole draft in one
// dispatch; cancel leaves the version untouched.
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
  const features = getBlockEditingFeatures(blockType.semantics)
  const { draft, setDraft, parsed, canSubmit, inspectorBlock } = useBlockDraft({
    mode,
    blockType,
    block,
    phases,
    lanes,
  })

  const typeLabel = t(`blockType.${blockType.type}`, { defaultValue: blockType.label })
  const typeDescription = t(`blockTypeDescription.${blockType.type}`, { defaultValue: '' })
  const upstreamBlocks = blocks.filter((b) => b.id !== block?.id)

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
          <BlockIdentityFields
            name={draft.name}
            phaseId={draft.phaseId}
            phases={phases}
            typeLabel={typeLabel}
            showName={features.hasName}
            onChangeName={(name) => setDraft({ ...draft, name })}
            onChangePhase={(phaseId) => setDraft({ ...draft, phaseId })}
          />

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

          {features.allowsLogic && (
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

          {features.allowsTiming && (
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

        <BlockDialogFooter
          mode={mode}
          canSubmit={canSubmit}
          showDelete={features.deletable}
          onSubmit={() => onSubmit(draft)}
          onCancel={onClose}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  )
}
