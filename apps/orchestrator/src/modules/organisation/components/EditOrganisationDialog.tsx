import { useForm } from '@tanstack/react-form'
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

import { useUpdateOrganisation } from '../hooks'
import type { OrganisationRead, OrganisationUpdatePayload } from '../schemas'

const ORG_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type'

interface FormValues {
  name: string
  type_code: string
  type_display: string
}

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

  const form = useForm({
    defaultValues: {
      name: organisation?.name ?? '',
      type_code: organisation?.type_code ?? 'prov',
      type_display: organisation?.type_display ?? '',
    } as FormValues,
    onSubmit: async ({ value }) => {
      if (!organisation) return
      const payload: OrganisationUpdatePayload = {
        name: value.name.trim(),
        type: {
          system: ORG_TYPE_SYSTEM,
          code: value.type_code.trim(),
          display: value.type_display?.trim() || null,
        },
      }
      try {
        const updated = await mutation.mutateAsync({
          organisationId: organisation.id,
          payload,
        })
        toast.success(t('edit.success'))
        onUpdated?.(updated)
        onOpenChange(false)
      } catch {
        toast.error(t('error.generic'))
      }
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
            void form.handleSubmit()
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
                  required
                />
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
                  required
                />
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
                />
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('edit.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t('edit.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
