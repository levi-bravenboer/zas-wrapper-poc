import { useEffect } from 'react'
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
import { useEntityForm } from '@/hooks/entity'

import { useUpdateOrganisation } from '../hooks'
import type { OrganisationRead, OrganisationUpdatePayload } from '../schemas'

import { organisationFormSchema, type OrganisationFormValues } from './organisationForm.schema'

const ORG_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type'

export interface EditOrganisationDialogProps {
  open: boolean
  organisation: OrganisationRead | null
  onOpenChange: (open: boolean) => void
  onUpdated?: (org: OrganisationRead) => void
}

export function EditOrganisationDialog({
  open,
  organisation,
  onOpenChange,
  onUpdated,
}: EditOrganisationDialogProps) {
  const { t } = useTranslation('organisations-admin-ui')
  const mutation = useUpdateOrganisation()

  const defaults: OrganisationFormValues = {
    name: organisation?.name ?? '',
    type_code: organisation?.type_code ?? 'prov',
    type_display: organisation?.type_display ?? '',
  }

  const { form, isSubmitting, submit } = useEntityForm<OrganisationFormValues>({
    schema: organisationFormSchema,
    defaultValues: defaults,
    onSubmit: async (value) => {
      if (!organisation) return
      const payload: OrganisationUpdatePayload = {
        name: value.name,
        type: {
          system: ORG_TYPE_SYSTEM,
          code: value.type_code,
          display: value.type_display || null,
        },
      }
      try {
        const updated = await mutation.mutateAsync({
          organisationId: organisation.id,
          payload,
        })
        onUpdated?.(updated)
      } catch (e) {
        toast.error(t('error.generic'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('edit.success'))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open && organisation) {
      form.reset({
        name: organisation.name,
        type_code: organisation.type_code,
        type_display: organisation.type_display ?? '',
      })
    }
  }, [open, organisation, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('create.field.name')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} t={t} />
              </div>
            )}
          </form.Field>
          <form.Field name="type_code">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('create.field.type_code')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} t={t} />
              </div>
            )}
          </form.Field>
          <form.Field name="type_display">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('create.field.type_display')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value ?? ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} t={t} />
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('edit.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {t('edit.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldError({ errors, t }: { errors: ReadonlyArray<unknown>; t: (key: string) => string }) {
  if (errors.length === 0) return null
  const first = errors[0]
  const raw =
    typeof first === 'string'
      ? first
      : typeof first === 'object' && first !== null && 'message' in first
        ? String((first as { message: unknown }).message)
        : String(first)
  const text = raw.startsWith('form.error.') ? t(raw) : raw
  return (
    <p className="text-xs text-destructive" role="alert">
      {text}
    </p>
  )
}
