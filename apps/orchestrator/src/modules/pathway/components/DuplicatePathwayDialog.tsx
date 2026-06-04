import { type ReactElement, useMemo, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useDuplicatePathway, usePathwayVersions } from '../hooks'

type Props = {
  pathwayId: string
  pathwayName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DuplicatePathwayDialog({
  pathwayId,
  pathwayName,
  open,
  onOpenChange,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const versions = usePathwayVersions(open ? pathwayId : undefined)
  const duplicate = useDuplicatePathway()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined)

  const defaultVersionId = useMemo(() => {
    if (!versions.data?.length) return undefined
    const published = versions.data
      .filter((v) => v.status === 'published')
      .sort((a, b) => b.version_no - a.version_no)
    if (published.length) return published[0].id
    return versions.data[0].id
  }, [versions.data])

  const activeVersionId = selectedVersionId ?? defaultVersionId

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setSelectedVersionId(undefined)
      duplicate.reset()
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeVersionId) return
    duplicate.mutate(
      { pathwayId, sourceVersionId: activeVersionId },
      {
        onSuccess: () => {
          toast.success(t('duplicate.success'))
          handleOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('duplicate.title')}</DialogTitle>
            <DialogDescription>{pathwayName}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>{t('duplicate.versionLabel')}</Label>
            <Select
              value={activeVersionId}
              onValueChange={setSelectedVersionId}
              disabled={!versions.data?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('duplicate.versionPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {versions.data?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {t('version.label', { n: v.version_no })} — {t(`version.status.${v.status}`)}
                    {v.label ? ` · ${v.label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {duplicate.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('duplicate.error')}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={duplicate.isPending}
            >
              {t('duplicate.cancel')}
            </Button>
            <Button type="submit" disabled={duplicate.isPending || !activeVersionId}>
              {t('duplicate.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
