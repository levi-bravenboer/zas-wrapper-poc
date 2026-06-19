import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/style/cn'
import { listPathways } from '@/modules/pathway/api'
import type { PathwaySummary } from '@/modules/pathway/types'

import {
  type CandidateUser,
  type EnrollmentApiError,
  fetchCandidateUsers,
  fetchEnrollDescriptor,
} from '../api'
import { useCreateEnrollment } from '../hooks'
import type { EnrollDescriptor, EnrollDescriptorField } from '../types'

type ParticipantSlot = NonNullable<EnrollDescriptor['participants']>[number]
type ClinicalDateSlots = NonNullable<EnrollDescriptor['clinical_dates']>

interface BlockStep {
  id: string
  label: string
  fields: EnrollDescriptorField[]
  participant: ParticipantSlot | null
}

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

function addDaysIso(iso: string, days: number): string {
  const base = iso || todayIso()
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Earliest feasible date for a clinical-date slot: the pathway's required lead
// time (`earliest_offset_days`) measured from the enrollment start (anchor), so
// it recomputes whenever the start date changes.
function clinicalEarliest(anchorDate: string, offsetDays: number): string {
  return addDaysIso(anchorDate, offsetDays)
}

// Clamp a stored clinical date up to its earliest-feasible value (the start
// date may have moved later since it was set).
function clinicalValue(stored: string | undefined, earliest: string): string {
  return stored && stored >= earliest ? stored : earliest
}

// Clinical-date slot names arrive as raw identifiers (e.g. `operation_date`);
// present them as a readable label.
function humanize(name: string): string {
  const spaced = name.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
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
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl max-h-[85vh]">
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

  const [step, setStep] = useState(0)
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
  const fields = useMemo(() => descriptorQuery.data?.fields ?? [], [descriptorQuery.data])
  const participantSlots = useMemo(
    () => descriptorQuery.data?.participants ?? [],
    [descriptorQuery.data],
  )
  const clinicalDateSlots = descriptorQuery.data?.clinical_dates ?? []

  const candidatesQuery = useQuery({
    queryKey: ['enroll-candidates'] as const,
    queryFn: fetchCandidateUsers,
    enabled: participantSlots.length > 0,
  })
  const candidates = candidatesQuery.data ?? []

  // One step per block: collect blocks in pathway order, attaching each block's
  // deferred fields and (optional) participant slot.
  const blocks = useMemo<BlockStep[]>(() => {
    const order: string[] = []
    const map = new Map<string, BlockStep>()
    const touch = (id: string, label: string): BlockStep => {
      let b = map.get(id)
      if (!b) {
        b = { id, label, fields: [], participant: null }
        map.set(id, b)
        order.push(id)
      }
      return b
    }
    for (const p of participantSlots) touch(p.block_template_id, p.block_label).participant = p
    for (const f of fields) touch(f.block_template_id, f.block_label).fields.push(f)
    return order.map((id) => map.get(id) as BlockStep)
  }, [fields, participantSlots])

  const stepLabels = [
    t('enroll.step.setup'),
    ...blocks.map((b) => b.label),
    t('enroll.step.review'),
  ]
  const total = stepLabels.length
  const reviewIndex = total - 1
  const current = Math.min(step, reviewIndex)

  function blockComplete(b: BlockStep): boolean {
    const fieldsOk = b.fields
      .filter((f) => f.required)
      .every((f) => (values[fieldKey(f)] ?? '').trim() !== '')
    const partOk = b.participant
      ? (participants[b.participant.block_template_id] ?? '') !== ''
      : true
    return fieldsOk && partOk
  }

  function stepValid(idx: number): boolean {
    if (idx === 0) return !!selected && anchorDate !== ''
    if (idx === reviewIndex) return true
    const b = blocks[idx - 1]
    return b ? blockComplete(b) : false
  }

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
    const clinicalDeferred = clinicalDateSlots.map((c) => ({
      block_template_id: c.block_template_id,
      attr: c.name,
      value_json: clinicalValue(
        clinicalDates[c.name],
        clinicalEarliest(anchorDate, c.earliest_offset_days),
      ),
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
      className="flex min-h-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (current === reviewIndex) void handleSubmit()
        else setStep(current + 1)
      }}
    >
      <Stepper
        labels={stepLabels}
        current={current}
        onJump={(idx) => idx <= current && setStep(idx)}
      />
      <p className="text-sm font-medium text-foreground">
        {t('enroll.stepIndicator', { current: current + 1, total })} · {stepLabels[current]}
      </p>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
        {current === 0 ? (
          <SetupStep
            publishable={publishable}
            pathwaysLoading={pathwaysQuery.isLoading}
            pathwayId={pathwayId}
            onPathwayChange={setPathwayId}
            anchorDate={anchorDate}
            onAnchorChange={setAnchorDate}
            clinicalDateSlots={clinicalDateSlots}
            clinicalDates={clinicalDates}
            onClinicalDateChange={(name, v) => setClinicalDates((prev) => ({ ...prev, [name]: v }))}
          />
        ) : current === reviewIndex ? (
          <ReviewStep
            pathwayName={selected?.name ?? ''}
            anchorDate={anchorDate}
            blocks={blocks}
            values={values}
            participants={participants}
            candidates={candidates}
            missing={missing}
          />
        ) : (
          <BlockStepBody
            block={blocks[current - 1] as BlockStep}
            values={values}
            onFieldChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
            participantId={
              blocks[current - 1]?.participant
                ? (participants[blocks[current - 1]!.participant!.block_template_id] ?? '')
                : ''
            }
            onParticipantChange={(blockId, v) =>
              setParticipants((prev) => ({ ...prev, [blockId]: v }))
            }
            candidates={candidates}
          />
        )}
      </div>

      <DialogFooter className="justify-between sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(current - 1)}
          disabled={current === 0 || mutation.isPending}
        >
          {t('enroll.back')}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('enroll.cancel')}
          </Button>
          {current === reviewIndex ? (
            <Button type="submit" disabled={!canSubmit}>
              {t('enroll.submit')}
            </Button>
          ) : (
            <Button type="submit" disabled={!stepValid(current)}>
              {t('enroll.next')}
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  )
}

type StepperSlot =
  | { kind: 'step'; idx: number }
  | { kind: 'more'; side: 'left' | 'right'; count: number; jumpTo: number }

// Beyond this many steps the full row no longer fits the dialog, so we
// collapse to a window of prev/current/next plus a "+N" indicator per side.
const STEPPER_FULL_MAX = 4

function buildStepperSlots(total: number, current: number): StepperSlot[] {
  if (total <= STEPPER_FULL_MAX) {
    return Array.from({ length: total }, (_, idx) => ({ kind: 'step', idx }))
  }
  const last = total - 1
  const start = Math.max(0, current - 1)
  const end = Math.min(last, current + 1)
  const slots: StepperSlot[] = []
  if (start > 0) slots.push({ kind: 'more', side: 'left', count: start, jumpTo: start - 1 })
  for (let idx = start; idx <= end; idx++) slots.push({ kind: 'step', idx })
  if (end < last) slots.push({ kind: 'more', side: 'right', count: last - end, jumpTo: end + 1 })
  return slots
}

function Stepper({
  labels,
  current,
  onJump,
}: {
  labels: string[]
  current: number
  onJump: (idx: number) => void
}): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const slots = buildStepperSlots(labels.length, current)
  return (
    <ol className="flex w-full items-start">
      {slots.map((slot, pos) => {
        const hasLeftLine = pos > 0
        const hasRightLine = pos < slots.length - 1
        if (slot.kind === 'more') {
          const past = slot.side === 'left'
          return (
            <li
              key={`more-${slot.side}`}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    !hasLeftLine ? 'opacity-0' : past ? 'bg-primary' : 'bg-border',
                  )}
                />
                <button
                  type="button"
                  onClick={() => past && onJump(slot.jumpTo)}
                  disabled={!past}
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border border-dashed text-[10px] font-medium text-muted-foreground',
                    past && 'cursor-pointer hover:border-primary hover:text-primary',
                  )}
                >
                  +{slot.count}
                </button>
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    !hasRightLine ? 'opacity-0' : past ? 'bg-primary' : 'bg-border',
                  )}
                />
              </div>
              <span className="max-w-full truncate px-0.5 text-center text-[11px] leading-tight text-muted-foreground">
                {past ? t('enroll.earlierSteps') : t('enroll.laterSteps')}
              </span>
            </li>
          )
        }
        const { idx } = slot
        const label = labels[idx] ?? ''
        const done = idx < current
        const active = idx === current
        const reachable = idx <= current
        return (
          <li key={`${idx}-${label}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  !hasLeftLine ? 'opacity-0' : reachable ? 'bg-primary' : 'bg-border',
                )}
              />
              <button
                type="button"
                title={label}
                aria-current={active ? 'step' : undefined}
                onClick={() => onJump(idx)}
                disabled={idx > current}
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors',
                  active && 'border-primary bg-primary text-primary-foreground shadow-sm',
                  done && 'border-primary bg-primary/10 text-primary',
                  !active && !done && 'border-border bg-background text-muted-foreground',
                  reachable && !active && 'cursor-pointer hover:border-primary',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : idx + 1}
              </button>
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  !hasRightLine ? 'opacity-0' : done ? 'bg-primary' : 'bg-border',
                )}
              />
            </div>
            <span
              title={label}
              className={cn(
                'max-w-full truncate px-0.5 text-center text-[11px] leading-tight',
                active ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface SetupStepProps {
  publishable: PublishablePathway[]
  pathwaysLoading: boolean
  pathwayId: string
  onPathwayChange: (id: string) => void
  anchorDate: string
  onAnchorChange: (v: string) => void
  clinicalDateSlots: ClinicalDateSlots
  clinicalDates: Record<string, string>
  onClinicalDateChange: (name: string, v: string) => void
}

function SetupStep({
  publishable,
  pathwaysLoading,
  pathwayId,
  onPathwayChange,
  anchorDate,
  onAnchorChange,
  clinicalDateSlots,
  clinicalDates,
  onClinicalDateChange,
}: SetupStepProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enroll-pathway">{t('enroll.pathwayLabel')}</Label>
        {publishable.length === 0 && !pathwaysLoading ? (
          <p className="text-sm text-muted-foreground">{t('enroll.noPublished')}</p>
        ) : (
          <Select value={pathwayId} onValueChange={onPathwayChange}>
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
          onChange={(e) => onAnchorChange(e.target.value)}
        />
      </div>

      {clinicalDateSlots.map((c) => {
        const earliest = clinicalEarliest(anchorDate, c.earliest_offset_days)
        return (
          <div key={c.name} className="flex flex-col gap-1.5">
            <Label htmlFor={`enroll-clinical-${c.name}`}>{humanize(c.name)}</Label>
            <Input
              id={`enroll-clinical-${c.name}`}
              type="date"
              min={earliest}
              value={clinicalValue(clinicalDates[c.name], earliest)}
              onChange={(e) =>
                onClinicalDateChange(
                  c.name,
                  e.target.value && e.target.value < earliest ? earliest : e.target.value,
                )
              }
            />
            {c.earliest_offset_days > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('enroll.earliestHint', { date: earliest })}
              </p>
            ) : null}
          </div>
        )
      })}
    </>
  )
}

// Scope a slot's dropdown to its required role + specialty. Falls back to the
// wider set (role-only, then all) when nothing matches, so a vocabulary
// mismatch in the data never leaves the dropdown empty.
function candidatesForSlot(candidates: CandidateUser[], slot: ParticipantSlot): CandidateUser[] {
  const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase()
  const byRole = candidates.filter((c) => norm(c.practitioner_role) === norm(slot.role))
  const base = byRole.length > 0 ? byRole : candidates
  if (!slot.specialty) return base
  const bySpec = base.filter((c) => norm(c.specialty) === norm(slot.specialty))
  return bySpec.length > 0 ? bySpec : base
}

interface BlockStepBodyProps {
  block: BlockStep
  values: Record<string, string>
  onFieldChange: (key: string, v: string) => void
  participantId: string
  onParticipantChange: (blockId: string, v: string) => void
  candidates: CandidateUser[]
}

function BlockStepBody({
  block,
  values,
  onFieldChange,
  participantId,
  onParticipantChange,
  candidates,
}: BlockStepBodyProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const options = useMemo(
    () => (block.participant ? candidatesForSlot(candidates, block.participant) : []),
    [candidates, block.participant],
  )
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <h3 className="text-base font-semibold text-foreground">{block.label}</h3>

      {block.fields.map((f) => {
        const key = fieldKey(f)
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`enroll-field-${key}`}>
              {f.label}
              {f.required ? ' *' : ''}
            </Label>
            <Input
              id={`enroll-field-${key}`}
              type={inputType(f.kind)}
              value={values[key] ?? ''}
              onChange={(e) => onFieldChange(key, e.target.value)}
            />
            {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
          </div>
        )
      })}

      {block.participant ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`enroll-participant-${block.participant.block_template_id}`}>
            {t('enroll.practitionerLabel')} · {block.participant.role}
            {block.participant.specialty ? ` (${block.participant.specialty})` : ''} *
          </Label>
          <Select
            value={participantId}
            onValueChange={(v) => onParticipantChange(block.participant!.block_template_id, v)}
          >
            <SelectTrigger id={`enroll-participant-${block.participant.block_template_id}`}>
              <SelectValue placeholder={t('enroll.participantPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

interface ReviewStepProps {
  pathwayName: string
  anchorDate: string
  blocks: BlockStep[]
  values: Record<string, string>
  participants: Record<string, string>
  candidates: CandidateUser[]
  missing: string[] | null
}

function ReviewStep({
  pathwayName,
  anchorDate,
  blocks,
  values,
  participants,
  candidates,
  missing,
}: ReviewStepProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const nameOf = (userId: string): string =>
    candidates.find((c) => c.id === userId)?.display_name ?? t('enroll.review.unset')
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">{t('enroll.review.title')}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('enroll.review.pathway')}</dt>
        <dd className="text-foreground">{pathwayName || t('enroll.review.unset')}</dd>
        <dt className="text-muted-foreground">{t('enroll.review.anchor')}</dt>
        <dd className="text-foreground">{anchorDate || t('enroll.review.unset')}</dd>
      </dl>
      <ul className="flex flex-col gap-2">
        {blocks.map((b) => (
          <li key={b.id} className="rounded-md border bg-card px-3 py-2 text-sm">
            <p className="font-medium text-foreground">{b.label}</p>
            {b.fields.map((f) => (
              <p key={fieldKey(f)} className="text-muted-foreground">
                {f.label}: {values[fieldKey(f)] || t('enroll.review.unset')}
              </p>
            ))}
            {b.participant ? (
              <p className="text-muted-foreground">
                {t('enroll.practitionerLabel')}:{' '}
                {nameOf(participants[b.participant.block_template_id] ?? '')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
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
    </div>
  )
}
