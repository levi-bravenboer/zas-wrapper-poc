import { useEffect } from 'react'
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
import { useEntityForm } from '@/hooks/entity'

import { useCreateOrganisation } from '../hooks'
import type { OrganisationCreatePayload, OrganisationRead } from '../schemas'

import { organisationFormSchema, type OrganisationFormValues } from './organisationForm.schema'

const ORG_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type'

const CREATE_DEFAULTS: OrganisationFormValues = {
  name: '',
  type_code: 'prov',
  type_display: '',
}

export interface CreateOrganisationDialogProps {
  open: boolean
  parent: OrganisationRead | null
  onOpenChange: (open: boolean) => void
  onCreated?: (org: OrganisationRead) => void
}

export function CreateOrganisationDialog({
  open,
  parent,
  onOpenChange,
  onCreated,
}: CreateOrganisationDialogProps) {
  const { t } = useTranslation('organisations-admin-ui')
  const mutation = useCreateOrganisation()

  const { form, isSubmitting, submit, reset } = useEntityForm<OrganisationFormValues>({
    schema: organisationFormSchema,
    defaultValues: CREATE_DEFAULTS,
    onSubmit: async (value) => {
      const payload: OrganisationCreatePayload = {
        name: value.name,
        type: {
          system: ORG_TYPE_SYSTEM,
          code: value.type_code,
          display: value.type_display || null,
        },
        parent_organisation_id: parent?.id ?? null,
      }
      try {
        const created = await mutation.mutateAsync(payload)
        onCreated?.(created)
      } catch (e) {
        toast.error(t('error.generic'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('create.success'))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const title = parent ? t('create.title_child') : t('create.title_root')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {parent && (
            <DialogDescription>
              {t('create.field.parent')}: {parent.name}
            </DialogDescription>
          )}
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
              {t('create.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {t('create.submit')}
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
