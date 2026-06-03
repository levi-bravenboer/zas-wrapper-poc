import { Link as RouterLink } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useDeletePathway, useParentReferences } from '../hooks'
import type { PathwayParentReference } from '../types'

type Props = {
  pathwayId: string | null
  pathwayName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

/**
 * Pre-checks for parent references (other pathways using this one as a
 * sub-pathway) and renders one of two states:
 *
 * - **Confirm** (no referrers): normal "are you sure?" with a Delete CTA.
 * - **Blocked** (referrers exist): explains why deletion isn't allowed and
 *   lists the referring pathways with links to open them.
 */
export function DeletePathwayDialog({
  pathwayId,
  pathwayName,
  open,
  onOpenChange,
  onDeleted,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const referencesQuery = useParentReferences(open ? (pathwayId ?? undefined) : undefined)
  const deletePathway = useDeletePathway()
  const [overrideReferrers, setOverrideReferrers] = useState<PathwayParentReference[] | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setOverrideReferrers(null)
      deletePathway.reset()
    }
    onOpenChange(next)
  }

  const referrers = overrideReferrers ?? referencesQuery.data ?? []
  const loading = open && referencesQuery.isLoading && overrideReferrers === null
  const blocked = referrers.length > 0

  async function handleDelete() {
    if (!pathwayId) return
    const result = await deletePathway.mutateAsync(pathwayId)
    if (result.ok) {
      toast.success(t('delete.pathwaySuccess', { name: pathwayName }))
      handleOpenChange(false)
      onDeleted?.()
      return
    }
    // Race: a pathway_link was added between the pre-check and the DELETE.
    // Swap the modal to the blocked state with the fresh referrer list.
    setOverrideReferrers(result.referrers)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {blocked && <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />}
            {blocked ? t('delete.blockedTitle') : t('delete.confirmTitle', { name: pathwayName })}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? t('delete.blockedDescription', { name: pathwayName })
              : t('delete.confirmDescription')}
          </DialogDescription>
        </DialogHeader>

        {blocked && (
          <ul
            className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border p-2 text-sm"
            style={{ borderColor: 'var(--hairline)' }}
          >
            {referrers.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.name}</span>
                <RouterLink
                  to="/pathways/$pathwayId"
                  params={{ pathwayId: r.id }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t('delete.openReferrer')}
                </RouterLink>
              </li>
            ))}
          </ul>
        )}

        {loading && <p className="text-sm text-muted-foreground">{t('delete.checking')}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t(blocked ? 'delete.close' : 'delete.cancel')}
          </Button>
          {!blocked && (
            <Button
              type="button"
              variant="danger"
              disabled={loading || deletePathway.isPending}
              onClick={() => void handleDelete()}
            >
              {deletePathway.isPending ? t('delete.deleting') : t('delete.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
