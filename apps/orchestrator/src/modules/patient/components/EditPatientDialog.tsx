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

import { useUpdatePatient } from '../hooks'
import type { PatientGender, PatientRow, PatientUpdatePayload } from '../types'

import { patientFormSchema, patientGenderEnum, type PatientFormValues } from './patientForm.schema'

function toDefaults(patient: PatientRow): PatientFormValues {
  return {
    given_name: patient.given_name ?? '',
    family_name: patient.family_name ?? '',
    birth_date: patient.birth_date ?? '',
    gender: patient.gender,
  }
}

function toPayload(values: PatientFormValues): PatientUpdatePayload {
  return {
    given_name: values.given_name.trim(),
    family_name: values.family_name.trim(),
    birth_date: values.birth_date.trim() === '' ? null : values.birth_date.trim(),
    gender: values.gender,
  }
}

export interface EditPatientDialogProps {
  patient: PatientRow
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPatientDialog({
  patient,
  open,
  onOpenChange,
}: EditPatientDialogProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const mutation = useUpdatePatient()

  const { form, isSubmitting, submit, reset } = useEntityForm<PatientFormValues>({
    schema: patientFormSchema,
    defaultValues: toDefaults(patient),
    onSubmit: async (values) => {
      try {
        await mutation.mutateAsync({ patientId: patient.id, payload: toPayload(values) })
      } catch (e) {
        toast.error(t('edit.toast.error'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('edit.toast.success'))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) reset()
    // intentionally watch open + patient.id so re-opening for a different
    // patient or after a save resets defaults to the fresh row.
  }, [open, patient.id, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
          <DialogDescription>{t('edit.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="given_name">
              {(field) => (
                <FieldRow
                  htmlFor="patient-given-name"
                  label={t('edit.fields.given_name')}
                  error={firstError(field.state.meta.errors, t)}
                >
                  <Input
                    id="patient-given-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                </FieldRow>
              )}
            </form.Field>

            <form.Field name="family_name">
              {(field) => (
                <FieldRow
                  htmlFor="patient-family-name"
                  label={t('edit.fields.family_name')}
                  error={firstError(field.state.meta.errors, t)}
                >
                  <Input
                    id="patient-family-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                </FieldRow>
              )}
            </form.Field>
          </div>

          <form.Field name="birth_date">
            {(field) => (
              <FieldRow
                htmlFor="patient-birth-date"
                label={t('edit.fields.birth_date')}
                error={firstError(field.state.meta.errors, t)}
              >
                <Input
                  id="patient-birth-date"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FieldRow>
            )}
          </form.Field>

          <form.Field name="gender">
            {(field) => (
              <FieldRow
                htmlFor="patient-gender"
                label={t('edit.fields.gender')}
                error={firstError(field.state.meta.errors, t)}
              >
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as PatientGender)}
                >
                  <SelectTrigger id="patient-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {patientGenderEnum.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {t(`gender.${opt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {t('edit.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('edit.submit')}
            </Button>
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
