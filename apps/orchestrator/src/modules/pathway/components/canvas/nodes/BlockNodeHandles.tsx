import { Position } from '@xyflow/react'
import { type ReactElement } from 'react'

import { HandlePort } from './HandlePort'

type Props = { isBranch: boolean }

export function BlockNodeHandles({ isBranch }: Props): ReactElement {
  return (
    <>
      <HandlePort
        id="in"
        type="target"
        position={Position.Left}
        ariaLabel="Verbinding in"
        style={{ left: -6 }}
      />
      {isBranch ? (
        <>
          <HandlePort
            id="yes"
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding ja-tak"
            style={{ right: -6, top: '28%' }}
          />
          <HandlePort
            id="no"
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding nee-tak"
            style={{ right: -6, top: '72%' }}
          />
        </>
      ) : (
        <HandlePort
          id="out"
          type="source"
          position={Position.Right}
          ariaLabel="Verbinding uit"
          style={{ right: -6 }}
        />
      )}
    </>
  )
}
