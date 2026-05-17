import { Position } from '@xyflow/react'
import { type ReactElement } from 'react'

import { BRANCH_HANDLE_OFFSET_PCT, HANDLE_IDS, HANDLE_OFFSET } from '../../../constants/edge'

import { HandlePort } from './HandlePort'

const BRANCH_YES_TOP = `${50 - BRANCH_HANDLE_OFFSET_PCT}%`
const BRANCH_NO_TOP = `${50 + BRANCH_HANDLE_OFFSET_PCT}%`

type Props = { isBranch: boolean }

export function BlockNodeHandles({ isBranch }: Props): ReactElement {
  return (
    <>
      <HandlePort
        id={HANDLE_IDS.target}
        type="target"
        position={Position.Left}
        ariaLabel="Verbinding in"
        style={{ left: HANDLE_OFFSET }}
      />
      {isBranch ? (
        <>
          <HandlePort
            id={HANDLE_IDS.source.branchYes}
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding ja-tak"
            style={{ right: HANDLE_OFFSET, top: BRANCH_YES_TOP }}
          />
          <HandlePort
            id={HANDLE_IDS.source.branchNo}
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding nee-tak"
            style={{ right: HANDLE_OFFSET, top: BRANCH_NO_TOP }}
          />
        </>
      ) : (
        <HandlePort
          id={HANDLE_IDS.source.plain}
          type="source"
          position={Position.Right}
          ariaLabel="Verbinding uit"
          style={{ right: HANDLE_OFFSET }}
        />
      )}
    </>
  )
}
