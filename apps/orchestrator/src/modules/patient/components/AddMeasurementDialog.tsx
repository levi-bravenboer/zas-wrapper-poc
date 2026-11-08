import { useEffect, type ReactElement } from 'react'
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
import { useEntityForm } from '@/hooks/entity'
import type { OwnerType } from '@/modules/collaboration/types'

import { useCreateObservation } from '../hooks'
import type { MeasurementType, ObservationCreatePayload } from '../types'

import {
  addMeasurementFormSchema,
  measurementTypeEnum,
  MEASUREMENT_TYPE_META,
  type AddMeasurementFormValues,
  type MeasurementTypeKey,
} from './addMeasurementForm.schema'

export interface AddMeasurementDialogProps {
  patientId: string
  /** Owner the measurement is recorded *on* — defaults to the patient when
   *  omitted. Set to the surrounding appointment/task when the dialog is
   *  opened from those contexts so the patient activity feed can tag it. */
  ownerType?: OwnerType | undefined
  ownerId?: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

// `<input type="datetime-local">` value: local-time `YYYY-MM-DDTHH:mm`.
function nowLocalIso(): string {
  const d = new Date()
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDefaults(): AddMeasurementFormValues {
  return {
    measurement_type: 'heart_rate',
    value: '',
    value_secondary: '',
    effective_date_time: nowLocalIso(),
  }
}

function toPayload(
  values: AddMeasurementFormValues,
  ownerType: OwnerType | undefined,
  ownerId: string | undefined,
): ObservationCreatePayload {
  const meta = MEASUREMENT_TYPE_META[values.measurement_type]
  return {
    measurement_type: values.measurement_type,
    value: Number(values.value),
    ...(meta.secondary ? { value_secondary: Number(values.value_secondary) } : {}),
    // Convert the form's local-time string to a UTC ISO string the API expects.
    effective_date_time: new Date(values.effective_date_time).toISOString(),
    ...(ownerType && ownerId ? { owner_type: ownerType, owner_id: ownerId } : {}),
  }
}

export function AddMeasurementDialog({
  patientId,
  ownerType,
  ownerId,
  open,
  onOpenChange,
}: AddMeasurementDialogProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const mutation = useCreateObservation()

  const { form, isSubmitting, submit, reset } = useEntityForm<AddMeasurementFormValues>({
    schema: addMeasurementFormSchema,
    defaultValues: toDefaults(),
    onSubmit: async (values) => {
      try {
        await mutation.mutateAsync({
          patientId,
          payload: toPayload(values, ownerType, ownerId),
        })
      } catch (e) {
        toast.error(t('addMeasurement.toast.error'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('addMeasurement.toast.success'))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addMeasurement.title')}</DialogTitle>
          <DialogDescription>{t('addMeasurement.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <form.Field name="measurement_type">
            {(field) => (
              <FieldRow
                htmlFor="measurement-type"
                label={t('addMeasurement.fields.type')}
                error={firstError(field.state.meta.errors, t)}
              >
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as MeasurementType)}
                >
                  <SelectTrigger id="measurement-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {measurementTypeEnum.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {t(`addMeasurement.type.${opt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.measurement_type}>
            {(type) => {
              const meta = MEASUREMENT_TYPE_META[type as MeasurementTypeKey]
              return (
                <>
                  <form.Field name="value">
                    {(field) => {
                      const errorMsg = firstError(field.state.meta.errors, t)
                      return (
                        <FieldRow
                          htmlFor="measurement-value"
                          label={t(meta.primaryLabelKey ?? 'addMeasurement.fields.value')}
                          error={errorMsg}
                          hint={errorMsg ? undefined : t(meta.hintKey)}
                        >
                          <div className="relative">
                            <Input
                              id="measurement-value"
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={meta.min}
                              max={meta.max}
                              placeholder={t(meta.placeholderKey)}
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                              aria-invalid={field.state.meta.errors.length > 0}
                              className="pr-16 text-2xl font-medium tabular-nums tracking-tight"
                            />
                            <span
                              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                              aria-hidden
                            >
                              {meta.unit}
                            </span>
                          </div>
                        </FieldRow>
                      )
                    }}
                  </form.Field>
                  {meta.secondary ? (
                    <form.Field name="value_secondary">
                      {(field) => {
                        const errorMsg = firstError(field.state.meta.errors, t)
                        const sec = meta.secondary!
                        return (
                          <FieldRow
                            htmlFor="measurement-value-secondary"
                            label={t(sec.labelKey)}
                            error={errorMsg}
                            hint={errorMsg ? undefined : t(sec.hintKey)}
                          >
                            <div className="relative">
                              <Input
                                id="measurement-value-secondary"
                                type="number"
                                inputMode="decimal"
                                step="any"
                                min={sec.min}
                                max={sec.max}
                                placeholder={t(sec.placeholderKey)}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                aria-invalid={field.state.meta.errors.length > 0}
                                className="pr-16 text-2xl font-medium tabular-nums tracking-tight"
                              />
                              <span
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                                aria-hidden
                              >
                                {sec.unit}
                              </span>
                            </div>
                          </FieldRow>
                        )
                      }}
                    </form.Field>
                  ) : null}
                </>
              )
            }}
          </form.Subscribe>

          <form.Field name="effective_date_time">
            {(field) => (
              <FieldRow
                htmlFor="measurement-time"
                label={t('addMeasurement.fields.effective_date_time')}
                error={firstError(field.state.meta.errors, t)}
              >
                <Input
                  id="measurement-time"
                  type="datetime-local"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FieldRow>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('addMeasurement.cancel')}
            </Button>
            <form.Subscribe selector={(state) => state.canSubmit}>
              {(canSubmit) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {t('addMeasurement.submit')}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface FieldRowProps {
  htmlFor: string
  label: string
  error?: string | undefined
  hint?: string | undefined
  children: ReactElement
}

function FieldRow({ htmlFor, label, error, hint, children }: FieldRowProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function firstError(
  errors: ReadonlyArray<unknown>,
  t: (key: string) => string,
): string | undefined {
  if (errors.length === 0) return undefined
  const first = errors[0]
  const raw =
    typeof first === 'string'
      ? first
      : typeof first === 'object' && first !== null && 'message' in first
        ? String((first as { message: unknown }).message)
        : String(first)
  return raw.startsWith('form.error.') ? t(raw) : raw
}
