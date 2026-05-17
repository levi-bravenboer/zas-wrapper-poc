import { Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { PathwayPhaseTemplate } from '../../types'

type Props = {
  templates: PathwayPhaseTemplate[]
  onPick: (template: PathwayPhaseTemplate | null, customLabel?: string) => void
}

export function PhasePickerPopover({ templates, onPick }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const submitCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = customValue.trim()
    if (!name) return
    setCustomValue('')
    setCustomOpen(false)
    onPick(null, name)
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setCustomOpen(false)
      }}
    >
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-[12.5px] font-medium text-foreground hover:bg-black/[0.04]"
        aria-haspopup="menu"
      >
        <Plus className="size-3" strokeWidth={1.8} />
        {t('subbar.addPhase')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
          {t('subbar.addPhase')}
        </DropdownMenuLabel>
        {templates
          .toSorted((a, b) => a.default_ord - b.default_ord)
          .map((template) => (
            <DropdownMenuItem
              key={template.id}
              onSelect={() => {
                setOpen(false)
                onPick(template)
              }}
            >
              {template.label}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        {customOpen ? (
          <form onSubmit={submitCustom} className="px-2 py-1.5">
            <input
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setCustomOpen(false)
                }
              }}
              placeholder={t('subbar.customPhasePlaceholder')}
              aria-label={t('subbar.customPhasePlaceholder')}
              className="w-full rounded-sm border border-[color:var(--hairline)] bg-white px-2 py-1 text-[12.5px] outline-none focus:border-[color:var(--color-primary)]"
            />
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {t('subbar.customPhaseHint')}
            </div>
          </form>
        ) : (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setCustomOpen(true)
            }}
          >
            {t('subbar.customPhase')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
