import { useEffect, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useCreateCareTeam } from '../hooks'

export interface CreateCareTeamDialogProps {
  open: boolean
  patientId: string
  onOpenChange: (open: boolean) => void
}

export function CreateCareTeamDialog({
  open,
  patientId,
  onOpenChange,
}: CreateCareTeamDialogProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const mutation = useCreateCareTeam()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setCategory('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync({
        patientId,
        payload: {
          name: name.trim() || null,
          category: category.trim() || null,
          participants: [],
        },
      })
      toast.success(t('createDialog.toast.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('createDialog.toast.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ct-name">{t('createDialog.name')}</Label>
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createDialog.namePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ct-category">{t('createDialog.category')}</Label>
            <Input
              id="ct-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('createDialog.categoryPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('createDialog.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t('createDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
