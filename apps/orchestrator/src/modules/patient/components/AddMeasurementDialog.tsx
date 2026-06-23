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

import { useCreateObservation } from '../hooks'
import type { MeasurementType, ObservationCreatePayload } from '../types'

import {
  addMeasurementFormSchema,
  measurementTypeEnum,
  type AddMeasurementFormValues,
} from './addMeasurementForm.schema'

export interface AddMeasurementDialogProps {
  patientId: string
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
    effective_date_time: nowLocalIso(),
  }
}

function toPayload(values: AddMeasurementFormValues): ObservationCreatePayload {
  return {
    measurement_type: values.measurement_type,
    value: Number(values.value),
    // Convert the form's local-time string to a UTC ISO string the API expects.
    effective_date_time: new Date(values.effective_date_time).toISOString(),
  }
}

export function AddMeasurementDialog({
  patientId,
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
        await mutation.mutateAsync({ patientId, payload: toPayload(values) })
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

          <form.Field name="value">
            {(field) => (
              <FieldRow
                htmlFor="measurement-value"
                label={t('addMeasurement.fields.value')}
                error={firstError(field.state.meta.errors, t)}
              >
                <Input
                  id="measurement-value"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FieldRow>
            )}
          </form.Field>

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
  children: ReactElement
}

function FieldRow({ htmlFor, label, error, children }: FieldRowProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
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
