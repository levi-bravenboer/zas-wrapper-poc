import { Plus } from 'lucide-react'
import { useState, type ReactElement } from 'react'
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
  onPick: (template: PathwayPhaseTemplate | null) => void
}

export function PhasePickerPopover({ templates, onPick }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-[12.5px] font-medium text-foreground hover:bg-black/[0.04]"
        aria-haspopup="menu"
      >
        <Plus className="size-3" strokeWidth={1.8} />
        {t('subbar.addPhase')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
          {t('subbar.addPhase')}
        </DropdownMenuLabel>
        {templates
          .slice()
          .sort((a, b) => a.default_ord - b.default_ord)
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
        <DropdownMenuItem
          onSelect={() => {
            setOpen(false)
            onPick(null)
          }}
        >
          {t('subbar.customPhase')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
