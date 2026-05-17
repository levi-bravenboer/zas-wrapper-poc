import { useCallback, useMemo, useState } from 'react'

export type DragContext =
  | { kind: 'idle' }
  | { kind: 'new'; typeCode: string; allowedLaneKindCodes: readonly string[] }
  | { kind: 'move'; blockId: string; typeCode: string; allowedLaneKindCodes: readonly string[] }

export type DragContextApi = {
  drag: DragContext
  startNewDrag: (typeCode: string, allowedLaneKindCodes: readonly string[]) => void
  startMoveDrag: (
    blockId: string,
    typeCode: string,
    allowedLaneKindCodes: readonly string[],
  ) => void
  endDrag: () => void
}

export function useDragContext(): DragContextApi {
  const [drag, setDrag] = useState<DragContext>({ kind: 'idle' })

  const startNewDrag = useCallback(
    (typeCode: string, allowedLaneKindCodes: readonly string[]) => {
      setDrag({ kind: 'new', typeCode, allowedLaneKindCodes })
    },
    [],
  )

  const startMoveDrag = useCallback(
    (blockId: string, typeCode: string, allowedLaneKindCodes: readonly string[]) => {
      setDrag({ kind: 'move', blockId, typeCode, allowedLaneKindCodes })
    },
    [],
  )

  const endDrag = useCallback(() => {
    setDrag((cur) => (cur.kind === 'idle' ? cur : { kind: 'idle' }))
  }, [])

  return useMemo(
    () => ({ drag, startNewDrag, startMoveDrag, endDrag }),
    [drag, startNewDrag, startMoveDrag, endDrag],
  )
}
