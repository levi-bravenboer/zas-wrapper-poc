import { useMemo, useState } from 'react'

import { sortByOrd } from '@/lib/utils/ordinal'

import { CONFIG_SCHEMAS, defaultConfig } from '../configSchemas'
import {
  legacyBlockConfig,
  type BlockConfig,
  type BlockDialogMode,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayLane,
  type PathwayPhase,
  type TimingPolicyValue,
} from '../types'
import { isLaneAllowed } from '../utils/laneRules'

type InputLogicShape = NonNullable<PathwayBlock['input_logic']>

type ParsedConfig =
  | { success: true; data: BlockConfig }
  | { success: false; error: unknown }

export type BlockDraft = {
  name: string
  phaseId: string
  laneId: string
  config: BlockConfig
  inputLogic: InputLogicShape
  timingPolicy: TimingPolicyValue
}

const EMPTY_LOGIC: InputLogicShape = { rules: [], aggregator: 'all_of' }

function initialDraft(
  mode: BlockDialogMode,
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

type Options = {
  mode: BlockDialogMode
  blockType: PathwayBlockType
  block: PathwayBlock | null
  phases: PathwayPhase[]
  lanes: PathwayLane[]
}

type Result = {
  draft: BlockDraft
  setDraft: (next: BlockDraft) => void
  parsed: ParsedConfig
  canSubmit: boolean
  /** Stub envelope so `InspectorSwitch` consumers that read block
   *  identity (e.g. WaitInspector's self-exclusion) behave in add mode
   *  too. */
  inspectorBlock: PathwayBlock
}

export function useBlockDraft({ mode, blockType, block, phases, lanes }: Options): Result {
  const [draft, setDraft] = useState<BlockDraft>(() =>
    initialDraft(
      mode,
      blockType,
      block,
      phases,
      lanes.filter((lane) => isLaneAllowed(blockType, lane.lane_kind_code)),
    ),
  )

  const parsed = useMemo<ParsedConfig>(() => {
    const result = CONFIG_SCHEMAS[blockType.semantics].safeParse(draft.config)
    return result.success
      ? { success: true, data: result.data as BlockConfig }
      : { success: false, error: result.error }
  }, [blockType.semantics, draft.config])

  const inspectorBlock = useMemo(
    () =>
      (block ?? {
        id: 'draft',
        phase_id: draft.phaseId,
        lane_id: draft.laneId,
        name: draft.name,
        input_logic: draft.inputLogic,
        timing_policy: null,
        x: 0,
        y: 0,
      }) as PathwayBlock,
    [block, draft.phaseId, draft.laneId, draft.name, draft.inputLogic],
  )

  const canSubmit = draft.phaseId !== '' && draft.laneId !== '' && parsed.success

  return { draft, setDraft, parsed, canSubmit, inspectorBlock }
}
