import { Position } from '@xyflow/react'
import { type ReactElement } from 'react'

import { HANDLE_IDS } from '../../../constants/edge'

import { HandlePort } from './HandlePort'

type Props = { isBranch: boolean }

export function BlockNodeHandles({ isBranch }: Props): ReactElement {
  return (
    <>
      <HandlePort
        id={HANDLE_IDS.target}
        type="target"
        position={Position.Left}
        ariaLabel="Verbinding in"
        style={{ left: -6 }}
      />
      {isBranch ? (
        <>
          <HandlePort
            id={HANDLE_IDS.source.branchYes}
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding ja-tak"
            style={{ right: -6, top: '28%' }}
          />
          <HandlePort
            id={HANDLE_IDS.source.branchNo}
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding nee-tak"
            style={{ right: -6, top: '72%' }}
          />
        </>
      ) : (
        <HandlePort
          id={HANDLE_IDS.source.plain}
          type="source"
          position={Position.Right}
          ariaLabel="Verbinding uit"
          style={{ right: -6 }}
        />
      )}
    </>
  )
}
