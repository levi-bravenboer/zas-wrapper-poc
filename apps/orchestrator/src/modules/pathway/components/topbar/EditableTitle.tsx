import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  value: string
  onCommit: (next: string) => void
}

export function EditableTitle({ value, onCommit }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        size={Math.max(8, draft.length + 1)}
        className="bg-transparent text-[14.5px] font-semibold tracking-tight text-foreground outline-none focus:underline"
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="text-[14.5px] font-semibold tracking-tight text-foreground hover:underline"
        onClick={() => setEditing(true)}
      >
        {value}
      </button>
      <button
        type="button"
        aria-label={t('topbar.renameLabel')}
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" strokeWidth={1.8} />
      </button>
    </span>
  )
}
