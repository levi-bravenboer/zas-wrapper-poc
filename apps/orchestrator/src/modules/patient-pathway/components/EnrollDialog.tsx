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

import { fetchCandidateUsers, fetchEnrollDescriptor, type EnrollmentApiError } from '../api'
import { useCreateEnrollment } from '../hooks'
import type { EnrollDescriptorField } from '../types'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function fieldKey(f: EnrollDescriptorField): string {
  return `${f.block_template_id}::${f.attr}`
}

function inputType(kind: string): string {
  if (kind === 'date') return 'date'
  if (kind === 'number') return 'number'
  return 'text'
}

function coerceValue(kind: string, raw: string): unknown {
  if (kind === 'number') {
    const n = Number(raw)
    return Number.isNaN(n) ? raw : n
  }
  return raw
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
  const [values, setValues] = useState<Record<string, string>>({})
  // block_template_id → resolved user_id
  const [participants, setParticipants] = useState<Record<string, string>>({})
  // clinical-date name → ISO date
  const [clinicalDates, setClinicalDates] = useState<Record<string, string>>({})

  const publishable = (pathwaysQuery.data ?? []).filter(isPublishable)
  const selected = publishable.find((p) => p.id === pathwayId)
  const versionId = selected?.latest_published_version_id ?? null

  const descriptorQuery = useQuery({
    queryKey: ['enroll-descriptor', versionId] as const,
    queryFn: () => fetchEnrollDescriptor(versionId as string),
    enabled: versionId !== null,
  })
  const fields = descriptorQuery.data?.fields ?? []
  const participantSlots = descriptorQuery.data?.participants ?? []
  const clinicalDateSlots = descriptorQuery.data?.clinical_dates ?? []

  const candidatesQuery = useQuery({
    queryKey: ['enroll-candidates'] as const,
    queryFn: fetchCandidateUsers,
    enabled: participantSlots.length > 0,
  })
  const candidates = candidatesQuery.data ?? []

  const requiredFilled = fields
    .filter((f) => f.required)
    .every((f) => (values[fieldKey(f)] ?? '').trim() !== '')
  const participantsResolved = participantSlots.every(
    (p) => (participants[p.block_template_id] ?? '') !== '',
  )
  const canSubmit =
    !!selected && anchorDate !== '' && requiredFilled && participantsResolved && !mutation.isPending

  async function handleSubmit(): Promise<void> {
    if (!selected) return
    setMissing(null)
    const deferred = fields
      .filter((f) => (values[fieldKey(f)] ?? '').trim() !== '')
      .map((f) => ({
        block_template_id: f.block_template_id,
        attr: f.attr,
        value_json: coerceValue(f.kind, values[fieldKey(f)] ?? ''),
      }))
    // Named clinical dates resolve `relative_to_date` timers; stored as a
    // deferred value keyed by the date name (resolution is by attr).
    const clinicalDeferred = clinicalDateSlots
      .filter((c) => (clinicalDates[c.name] ?? '') !== '')
      .map((c) => ({
        block_template_id: c.block_template_id,
        attr: c.name,
        value_json: clinicalDates[c.name] ?? '',
      }))
    const resolvedParticipants = participantSlots
      .filter((p) => (participants[p.block_template_id] ?? '') !== '')
      .map((p) => ({
        block_template_id: p.block_template_id,
        user_id: participants[p.block_template_id] as string,
        role: p.role,
      }))
    try {
      await mutation.mutateAsync({
        patient_id: patientId,
        pathway_version_id: selected.latest_published_version_id,
        anchor_date: anchorDate,
        deferred_values: [...deferred, ...clinicalDeferred],
        participants: resolvedParticipants,
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

      {fields.map((f) => {
        const key = fieldKey(f)
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`enroll-field-${key}`}>
              {f.block_label} · {f.label}
              {f.required ? ' *' : ''}
            </Label>
            <Input
              id={`enroll-field-${key}`}
              type={inputType(f.kind)}
              value={values[key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            />
            {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
          </div>
        )
      })}

      {clinicalDateSlots.map((c) => (
        <div key={c.name} className="flex flex-col gap-1.5">
          <Label htmlFor={`enroll-clinical-${c.name}`}>{c.name}</Label>
          <Input
            id={`enroll-clinical-${c.name}`}
            type="date"
            value={clinicalDates[c.name] ?? ''}
            onChange={(e) => setClinicalDates((prev) => ({ ...prev, [c.name]: e.target.value }))}
          />
        </div>
      ))}

      {participantSlots.map((p) => (
        <div key={p.block_template_id} className="flex flex-col gap-1.5">
          <Label htmlFor={`enroll-participant-${p.block_template_id}`}>
            {p.block_label} · {p.role}
            {p.specialty ? ` (${p.specialty})` : ''} *
          </Label>
          <Select
            value={participants[p.block_template_id] ?? ''}
            onValueChange={(v) =>
              setParticipants((prev) => ({ ...prev, [p.block_template_id]: v }))
            }
          >
            <SelectTrigger id={`enroll-participant-${p.block_template_id}`}>
              <SelectValue placeholder={t('enroll.participantPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

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
