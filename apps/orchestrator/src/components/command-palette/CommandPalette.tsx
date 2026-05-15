import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'

import { useCommandPalette } from './context'
import type { CommandEntry } from './types'

function groupEntries(
  entries: readonly CommandEntry[],
): readonly (readonly [string, readonly CommandEntry[]])[] {
  const buckets = new Map<string, CommandEntry[]>()
  for (const entry of entries) {
    const bucket = buckets.get(entry.group)
    if (bucket) {
      bucket.push(entry)
    } else {
      buckets.set(entry.group, [entry])
    }
  }
  return Array.from(buckets.entries())
}

export function CommandPalette(): ReactElement {
  const { t } = useTranslation('shell')
  const { open, setOpen, entries } = useCommandPalette()
  const groups = groupEntries(entries)

  function runAndClose(entry: CommandEntry): void {
    setOpen(false)
    void entry.perform()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t('palette.placeholder')}>
      <CommandInput placeholder={t('palette.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('palette.empty')}</CommandEmpty>
        {groups.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((entry) => {
              const Icon = entry.icon
              const keywords = entry.keywords?.join(' ') ?? ''
              return (
                <CommandItem
                  key={entry.id}
                  value={`${entry.label} ${keywords}`.trim()}
                  onSelect={() => {
                    runAndClose(entry)
                  }}
                >
                  {Icon && <Icon aria-hidden="true" />}
                  <span>{entry.label}</span>
                  {entry.shortcut && <CommandShortcut>{entry.shortcut}</CommandShortcut>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
