import { TriangleAlert } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'

import type { PathwayBlock, PathwayPhase } from '../../types'

import { DialogHero } from './DialogHero'

type Props = {
  open: boolean
  phase: PathwayPhase
  /** Blocks placed in the phase — cascade-removed together with it. */
  blocks: PathwayBlock[]
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDeletePhaseDialog({
  open,
  phase,
  blocks,
  onConfirm,
  onClose,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHero
          tone="destructive"
          icon={<TriangleAlert className="size-4" />}
          title={t('deletePhase.title')}
          description={phase.label}
        />

        {blocks.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground">{t('deletePhase.blocksIntro')}</p>
            <ul className="space-y-1.5">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-[12px]"
                >
                  <span>{b.name || t('deleteBlock.unnamed')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-2.5 py-3 text-center text-[12px] text-muted-foreground">
            {t('deletePhase.noBlocks')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('blockDialog.cancel', { defaultValue: 'Annuleren' })}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {blocks.length > 0 ? t('deletePhase.confirmCascade') : t('deletePhase.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
