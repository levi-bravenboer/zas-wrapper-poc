import { TriangleAlert } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { BlockTypeIcon } from '../../blockCatalogue'
import { legacyBlockType, type PathwayBlock, type PathwayBlockType } from '../../types'

type Props = {
  open: boolean
  block: PathwayBlock
  /** Blocks whose input_logic references the block — their rules get stripped. */
  dependents: PathwayBlock[]
  blockTypes: PathwayBlockType[]
  onConfirm: () => void
  onClose: () => void
}

// Pathway-completion § C5.2: delete confirmation enumerating the
// dependent blocks whose input_logic rules will be cascade-stripped.
export function ConfirmDeleteBlockDialog({
  open,
  block,
  dependents,
  blockTypes,
  onConfirm,
  onClose,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const typesByCode = new Map(blockTypes.map((bt) => [bt.type, bt]))

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-[15px]">
                {t('deleteBlock.title', { defaultValue: 'Blok verwijderen?' })}
              </DialogTitle>
              <DialogDescription className="text-[12px]">
                {block.name ||
                  t('deleteBlock.unnamed', { defaultValue: '(naamloos blok)' })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {dependents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground">
              {t('deleteBlock.dependentsIntro', {
                defaultValue:
                  'De volgende blokken verwijzen ernaar — hun logica-regels worden opgeschoond.',
              })}
            </p>
            <ul className="space-y-1.5">
              {dependents.map((dep) => {
                const bt = typesByCode.get(legacyBlockType(dep))
                return (
                  <li
                    key={dep.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-[12px]"
                  >
                    <BlockTypeIcon
                      icon={bt?.icon}
                      className="size-3.5 text-muted-foreground"
                      strokeWidth={1.7}
                    />
                    <span>{dep.name || dep.id.slice(0, 8)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-2.5 py-3 text-center text-[12px] text-muted-foreground">
            {t('deleteBlock.noDependents', {
              defaultValue: 'Geen afhankelijke blokken — veilig om te verwijderen.',
            })}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('blockDialog.cancel', { defaultValue: 'Annuleren' })}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {dependents.length > 0
              ? t('deleteBlock.confirmCascade', {
                  defaultValue: 'Verwijderen + opschonen',
                })
              : t('deleteBlock.confirm', { defaultValue: 'Verwijderen' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
