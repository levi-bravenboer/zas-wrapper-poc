import { Pencil } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { useEditableField } from '@/lib/hooks/useEditableField'

type Props = {
  value: string
  onCommit: (next: string) => void
}

export function EditableTitle({ value, onCommit }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const { editing, draft, inputRef, startEditing, setDraft, commit, onKeyDown } = useEditableField({
    value,
    onCommit,
  })

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
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
        onClick={startEditing}
      >
        {value}
      </button>
      <button
        type="button"
        aria-label={t('topbar.renameLabel')}
        className="text-muted-foreground hover:text-foreground"
        onClick={startEditing}
      >
        <Pencil className="size-3.5" strokeWidth={1.8} />
      </button>
    </span>
  )
}
