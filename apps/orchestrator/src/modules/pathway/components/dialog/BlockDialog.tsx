import { type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

import { BlockTypeIcon } from '../../blockCatalogue'
import { defaultConfig } from '../../configSchemas'
import { useBlockDraft, type BlockDraft } from '../../hooks/useBlockDraft'
import {
  type BlockConfig,
  type BlockDialogMode,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayLane,
  type PathwayPhase,
} from '../../types'
import { getBlockEditingFeatures } from '../../utils/blockEditingFeatures'
import { InspectorSwitch } from '../drawer/InspectorSwitch'

import { BlockDialogFooter } from './BlockDialogFooter'
import { BlockIdentityFields } from './BlockIdentityFields'
import { DialogHero } from './DialogHero'
import { DialogSection } from './DialogSection'
import { InputLogicEditor } from './InputLogicEditor'
import { TimingPolicyEditor } from './TimingPolicyEditor'

export type { BlockDraft } from '../../hooks/useBlockDraft'

const TITLE_KEY: Record<BlockDialogMode, { key: string; fallback: string }> = {
  add: { key: 'blockDialog.addTitle', fallback: 'Nieuw blok — {{type}}' },
  edit: { key: 'blockDialog.editTitle', fallback: 'Blok bewerken — {{type}}' },
}

type Props = {
  open: boolean
  mode: BlockDialogMode
  blockType: PathwayBlockType
  /** Edit mode: the block being edited. Add mode: null. */
  block: PathwayBlock | null
  phases: PathwayPhase[]
  /** Full lane list — the dialog derives the block's lane from
   * `blockType.allowed_lane_kind_codes` (first match wins; no picker). */
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  currentPathwayId: string
  onSubmit: (draft: BlockDraft) => void
  onDelete?: (() => void) | undefined
  onClose: () => void
}

// Pathway-completion § C4: per-block authoring surface. Per-kind
// rules live in `getBlockEditingFeatures`; draft state in
// `useBlockDraft`.
export function BlockDialog({
  open,
  mode,
  blockType,
  block,
  phases,
  lanes,
  blocks,
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
  const title = t(TITLE_KEY[mode].key, { defaultValue: TITLE_KEY[mode].fallback, type: typeLabel })

  // Adding a section = one entry.
  const sections: Array<{ id: string; visible: boolean; header: string; body: ReactNode }> = [
    {
      id: 'config',
      visible: true,
      header: t('blockDialog.configHeader', { defaultValue: 'Blok-instellingen' }),
      body: parsed.success ? (
        <InspectorSwitch
          blockType={blockType}
          block={inspectorBlock}
          data={parsed.data}
          blocks={blocks}
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
      ),
    },
    {
      id: 'logic',
      visible: features.allowsLogic,
      header: t('blockDialog.logicHeader', { defaultValue: 'Bedrijfslogica' }),
      body: (
        <InputLogicEditor
          value={draft.inputLogic}
          upstreamBlocks={upstreamBlocks}
          onChange={(inputLogic) => setDraft({ ...draft, inputLogic })}
        />
      ),
    },
    {
      id: 'timing',
      visible: features.allowsTiming,
      header: t('blockDialog.timingHeader', { defaultValue: 'Timing' }),
      body: (
        <TimingPolicyEditor
          value={draft.timingPolicy}
          onChange={(timingPolicy) => setDraft({ ...draft, timingPolicy })}
        />
      ),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[560px]">
        <DialogHero
          icon={<BlockTypeIcon icon={blockType.icon} className="size-5" strokeWidth={1.7} />}
          title={title}
          description={typeDescription || undefined}
        />

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

          {sections
            .filter((s) => s.visible)
            .map((s) => (
              <DialogSection key={s.id} header={s.header}>
                {s.body}
              </DialogSection>
            ))}
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
