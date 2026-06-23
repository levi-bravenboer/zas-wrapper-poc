import { useMemo, type ReactElement } from 'react'
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
import { useCan } from '@/modules/auth/permissions'
import { useMyOrganisations, useOrganisations } from '@/modules/organisation/hooks'
import type { OrganisationRead } from '@/modules/organisation/schemas'

import { useCreatePatient } from '../hooks'
import type { PatientCreatePayload, PatientGender } from '../types'

import { createPatientFormSchema, type CreatePatientFormValues } from './createPatientForm.schema'
import { patientGenderEnum } from './patientForm.schema'

export interface CreatePatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePatientDialog({
  open,
  onOpenChange,
}: CreatePatientDialogProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const canCrossOrg = useCan('patient.createCrossOrg')

  // Cross-org holders pick from every in-tenant org; others from their own
  // affiliated orgs. Only the relevant query runs while the dialog is open.
  const allOrgs = useOrganisations({ enabled: open && canCrossOrg })
  const ownOrgs = useMyOrganisations({ enabled: open && !canCrossOrg })
  const orgQuery = canCrossOrg ? allOrgs : ownOrgs
  const orgs = orgQuery.data ?? []
  const showSelector = canCrossOrg || orgs.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>
        {orgQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('state.loading')}</p>
        ) : (
          <CreatePatientForm orgs={orgs} showSelector={showSelector} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function toPayload(values: CreatePatientFormValues): PatientCreatePayload {
  const org = values.primary_organisation_id.trim()
  return {
    given_name: values.given_name.trim(),
    family_name: values.family_name.trim(),
    birth_date: values.birth_date.trim() === '' ? null : values.birth_date.trim(),
    gender: values.gender,
    source: 'local',
    identifiers: [],
    ...(org === '' ? {} : { primary_organisation_id: org }),
  }
}

interface CreatePatientFormProps {
  orgs: OrganisationRead[]
  showSelector: boolean
  onOpenChange: (open: boolean) => void
}

function CreatePatientForm({
  orgs,
  showSelector,
  onOpenChange,
}: CreatePatientFormProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const mutation = useCreatePatient()
  const schema = useMemo(() => createPatientFormSchema(showSelector), [showSelector])

  const { form, isSubmitting, submit } = useEntityForm<CreatePatientFormValues>({
    schema,
    defaultValues: {
      given_name: '',
      family_name: '',
      birth_date: '',
      gender: 'unknown',
      primary_organisation_id: showSelector && orgs.length === 1 ? (orgs[0]?.id ?? '') : '',
    },
    onSubmit: async (values) => {
      try {
        await mutation.mutateAsync(toPayload(values))
      } catch (e) {
        toast.error(t('create.toast.error'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('create.toast.success'))
      onOpenChange(false)
    },
  })

  return (
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
              htmlFor="create-patient-given-name"
              label={t('create.fields.given_name')}
              error={firstError(field.state.meta.errors, t)}
            >
              <Input
                id="create-patient-given-name"
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
              htmlFor="create-patient-family-name"
              label={t('create.fields.family_name')}
              error={firstError(field.state.meta.errors, t)}
            >
              <Input
                id="create-patient-family-name"
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
            htmlFor="create-patient-birth-date"
            label={t('create.fields.birth_date')}
            error={firstError(field.state.meta.errors, t)}
          >
            <Input
              id="create-patient-birth-date"
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
            htmlFor="create-patient-gender"
            label={t('create.fields.gender')}
            error={firstError(field.state.meta.errors, t)}
          >
            <Select
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v as PatientGender)}
            >
              <SelectTrigger id="create-patient-gender">
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

      {showSelector && (
        <form.Field name="primary_organisation_id">
          {(field) => (
            <FieldRow
              htmlFor="create-patient-organisation"
              label={t('create.fields.primary_organisation_id')}
              error={firstError(field.state.meta.errors, t)}
            >
              <Select
                value={field.state.value}
                onValueChange={(v) => {
                  field.handleChange(v)
                  field.handleBlur()
                }}
              >
                <SelectTrigger id="create-patient-organisation">
                  <SelectValue placeholder={t('create.org.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}
        </form.Field>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {t('create.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {t('create.submit')}
        </Button>
      </DialogFooter>
    </form>
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
