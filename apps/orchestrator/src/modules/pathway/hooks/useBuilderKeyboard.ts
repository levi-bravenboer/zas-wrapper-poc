import { useEffect } from 'react'

import type { BuilderAction } from '../useBuilderState'

type Options = {
  flush: () => void
  dispatch: (action: BuilderAction) => void
}

export function useBuilderKeyboard({ flush, dispatch }: Options): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        flush()
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault()
        dispatch({ type: 'redo' })
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatch({ type: 'undo' })
      } else if (event.key === 'Escape') {
        dispatch({ type: 'select', selection: { kind: 'none' } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush, dispatch])
}
