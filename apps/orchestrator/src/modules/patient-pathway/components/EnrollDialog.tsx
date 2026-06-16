import { useQuery } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listPathways } from '@/modules/pathway/api'
import type { PathwaySummary } from '@/modules/pathway/types'

import type { EnrollmentApiError } from '../api'
import { useCreateEnrollment } from '../hooks'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type PublishablePathway = PathwaySummary & { latest_published_version_id: string }

function isPublishable(p: PathwaySummary): p is PublishablePathway {
  return typeof p.latest_published_version_id === 'string'
}

export interface EnrollDialogProps {
  patientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnrollDialog({ patientId, open, onOpenChange }: EnrollDialogProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('enroll.title')}</DialogTitle>
          <DialogDescription>{t('enroll.description')}</DialogDescription>
        </DialogHeader>
        {open ? <EnrollForm patientId={patientId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

interface EnrollFormProps {
  patientId: string
  onClose: () => void
}

// Mounted only while the dialog is open, so its draft state resets on each
// open without a setState-in-effect.
function EnrollForm({ patientId, onClose }: EnrollFormProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const mutation = useCreateEnrollment(patientId)

  const pathwaysQuery = useQuery({
    queryKey: ['pathways', 'list'] as const,
    queryFn: listPathways,
  })

  const [pathwayId, setPathwayId] = useState<string>('')
  const [anchorDate, setAnchorDate] = useState<string>(todayIso)
  const [missing, setMissing] = useState<string[] | null>(null)

  const publishable = (pathwaysQuery.data ?? []).filter(isPublishable)
  const selected = publishable.find((p) => p.id === pathwayId)
  const canSubmit = !!selected && anchorDate !== '' && !mutation.isPending

  async function handleSubmit(): Promise<void> {
    if (!selected) return
    setMissing(null)
    try {
      await mutation.mutateAsync({
        patient_id: patientId,
        pathway_version_id: selected.latest_published_version_id,
        anchor_date: anchorDate,
        deferred_values: [],
      })
      toast.success(t('enroll.toast.success'))
      onClose()
    } catch (e) {
      const err = e as EnrollmentApiError
      if (err.missing && err.missing.length > 0) {
        setMissing(err.missing)
      } else {
        toast.error(t('enroll.toast.error'))
      }
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enroll-pathway">{t('enroll.pathwayLabel')}</Label>
        {publishable.length === 0 && !pathwaysQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('enroll.noPublished')}</p>
        ) : (
          <Select value={pathwayId} onValueChange={setPathwayId}>
            <SelectTrigger id="enroll-pathway">
              <SelectValue placeholder={t('enroll.pathwayPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {publishable.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enroll-anchor">{t('enroll.anchorLabel')}</Label>
        <Input
          id="enroll-anchor"
          type="date"
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value)}
        />
      </div>

      {missing ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">{t('enroll.validationTitle')}</p>
          <ul className="mt-1 list-inside list-disc text-xs text-destructive">
            {missing.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          {t('enroll.cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {t('enroll.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
