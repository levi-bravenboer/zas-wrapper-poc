import { useNavigate } from '@tanstack/react-router'
import { type ReactElement, useId, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { useCreatePathway } from '../hooks'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePathwayDialog({ open, onOpenChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const createPathway = useCreatePathway()
  const nameId = useId()
  const clinicalId = useId()
  const patientId = useId()

  const [name, setName] = useState('')
  const [clinicalGoal, setClinicalGoal] = useState('')
  const [patientGoal, setPatientGoal] = useState('')

  function reset() {
    setName('')
    setClinicalGoal('')
    setPatientGoal('')
    createPathway.reset()
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedClinical = clinicalGoal.trim()
    const trimmedPatient = patientGoal.trim()
    if (!trimmedName || !trimmedClinical || !trimmedPatient) return
    createPathway.mutate(
      { name: trimmedName, clinical_goal: trimmedClinical, patient_goal: trimmedPatient },
      {
        onSuccess: (created) => {
          handleOpenChange(false)
          void navigate({ to: '/pathways/$pathwayId', params: { pathwayId: created.id } })
        },
      },
    )
  }

  const submitDisabled =
    createPathway.isPending || !name.trim() || !clinicalGoal.trim() || !patientGoal.trim()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogDescription>{t('create.sub')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={nameId}>{t('create.nameLabel')}</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('create.namePlaceholder')}
                maxLength={255}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={clinicalId}>{t('create.clinicalGoalLabel')}</Label>
              <Textarea
                id={clinicalId}
                value={clinicalGoal}
                onChange={(event) => setClinicalGoal(event.target.value)}
                placeholder={t('create.clinicalGoalPlaceholder')}
                rows={3}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={patientId}>{t('create.patientGoalLabel')}</Label>
              <Textarea
                id={patientId}
                value={patientGoal}
                onChange={(event) => setPatientGoal(event.target.value)}
                placeholder={t('create.patientGoalPlaceholder')}
                rows={3}
                required
              />
            </div>
          </div>

          {createPathway.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('create.error')}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createPathway.isPending}
            >
              {t('create.cancel')}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {t('create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
