import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { CONFIG_SCHEMAS, type ConfigForSemantics } from '../../configSchemas'
import type {
  BlockConfig,
  PathwayBlock,
  PathwayBlockBranch,
  PathwayBlockType,
} from '../../types'

import { AppointmentInspector } from './inspectors/AppointmentInspector'
import { DecisionInspector } from './inspectors/DecisionInspector'
import { FormInspector } from './inspectors/FormInspector'
import { InformedConsentInspector } from './inspectors/InformedConsentInspector'
import { LusciiProgramInspector } from './inspectors/LusciiProgramInspector'
import { MdoInspector } from './inspectors/MdoInspector'
import { MessageInspector } from './inspectors/MessageInspector'
import { MilestoneInspector } from './inspectors/MilestoneInspector'
import { PathwayLinkInspector } from './inspectors/PathwayLinkInspector'
import { TaskInspector } from './inspectors/TaskInspector'
import { TreatmentInspector } from './inspectors/TreatmentInspector'
import { WaitInspector } from './inspectors/WaitInspector'

export type InspectorSwitchProps = {
  blockType: PathwayBlockType
  block: PathwayBlock
  data: ConfigForSemantics<PathwayBlockType['semantics']>
  blocks: PathwayBlock[]
  branches: PathwayBlockBranch[]
  currentPathwayId: string
  onPatchConfig: (next: BlockConfig) => void
}

// Per-kind config form router, shared by the block dialog (add + edit
// modes). Structural marker kinds (`start`, `end_pathway`) have no
// per-kind authoring surface beyond the inherited name.
export function InspectorSwitch({
  blockType,
  block,
  data,
  blocks,
  branches,
  currentPathwayId,
  onPatchConfig,
}: InspectorSwitchProps): ReactElement | null {
  const { t } = useTranslation('pathway')
  const semantics = blockType.semantics
  switch (semantics) {
    case 'appointment':
      return (
        <AppointmentInspector
          config={data as ConfigForSemantics<'appointment'>}
          onChange={onPatchConfig}
        />
      )
    case 'treatment':
      return (
        <TreatmentInspector
          config={data as ConfigForSemantics<'treatment'>}
          onChange={onPatchConfig}
        />
      )
    case 'task':
      return <TaskInspector config={data as ConfigForSemantics<'task'>} onChange={onPatchConfig} />
    case 'message':
      return (
        <MessageInspector config={data as ConfigForSemantics<'message'>} onChange={onPatchConfig} />
      )
    case 'informed_consent':
      return (
        <InformedConsentInspector
          config={data as ConfigForSemantics<'informed_consent'>}
          onChange={onPatchConfig}
        />
      )
    case 'mdo':
      return <MdoInspector config={data as ConfigForSemantics<'mdo'>} onChange={onPatchConfig} />
    case 'form':
      return <FormInspector config={data as ConfigForSemantics<'form'>} onChange={onPatchConfig} />
    case 'decision':
      return (
        <DecisionInspector
          config={data as ConfigForSemantics<'decision'>}
          branches={branches}
          onChange={onPatchConfig}
        />
      )
    case 'milestone':
      return (
        <MilestoneInspector
          config={data as ConfigForSemantics<'milestone'>}
          onChange={onPatchConfig}
        />
      )
    case 'wait':
      return (
        <WaitInspector
          config={data as ConfigForSemantics<'wait'>}
          blocks={blocks}
          currentBlockId={block.id}
          onChange={onPatchConfig}
        />
      )
    case 'pathway_link':
      return (
        <PathwayLinkInspector
          config={data as ConfigForSemantics<'pathway_link'>}
          currentPathwayId={currentPathwayId}
          onChange={onPatchConfig}
        />
      )
    case 'external_program':
      return (
        <LusciiProgramInspector
          config={data as ConfigForSemantics<'external_program'>}
          onChange={onPatchConfig}
        />
      )
    case 'start':
    case 'end_pathway':
      return (
        <p className="text-[11px] text-muted-foreground">
          {t('inspector.structural.noConfig', {
            defaultValue: 'Dit blok heeft geen instellingen — alleen een naam.',
          })}
        </p>
      )
    default: {
      // Exhaustiveness — if a new semantics is added without a case, the
      // schemas map keeps TS honest.
      void (CONFIG_SCHEMAS satisfies Record<PathwayBlockType['semantics'], unknown>)
      return null
    }
  }
}
