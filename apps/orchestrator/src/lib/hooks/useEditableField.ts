import { useCallback, useState } from 'react'

type Options = {
  value: string
  onCommit: (next: string) => void
}

type EditableField = {
  editing: boolean
  draft: string
  inputRef: (node: HTMLInputElement | null) => void
  startEditing: () => void
  setDraft: (next: string) => void
  commit: () => void
  cancel: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

export function useEditableField({ value, onCommit }: Options): EditableField {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const inputRef = useCallback((node: HTMLInputElement | null) => {
    node?.focus()
  }, [])

  function commit() {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else setDraft(value)
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      cancel()
    }
  }

  return {
    editing,
    draft,
    inputRef,
    startEditing: () => setEditing(true),
    setDraft,
    commit,
    cancel,
    onKeyDown,
  }
}
