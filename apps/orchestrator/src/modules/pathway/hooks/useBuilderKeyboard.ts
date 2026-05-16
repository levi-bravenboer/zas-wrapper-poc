import { useEffect } from 'react'

import type { SaveState } from '../components/topbar/SaveStatusPill'
import type { BuilderAction } from '../useBuilderState'

type Options = {
  isDirty: boolean
  saveState: SaveState
  onSave: () => void
  dispatch: (action: BuilderAction) => void
}

export function useBuilderKeyboard({ isDirty, saveState, onSave, dispatch }: Options): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        if (isDirty && saveState !== 'saving') onSave()
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
  }, [isDirty, saveState, onSave, dispatch])
}
