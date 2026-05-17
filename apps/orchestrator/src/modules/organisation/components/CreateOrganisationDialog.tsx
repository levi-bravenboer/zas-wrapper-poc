import { useForm } from '@tanstack/react-form'
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

import { useCreateOrganisation } from '../hooks'
import type { OrganisationCreatePayload, OrganisationRead } from '../schemas'

const ORG_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type'

interface FormValues {
  name: string
  type_code: string
  type_display: string
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

  const form = useForm({
    defaultValues: { name: '', type_code: 'prov', type_display: '' } as FormValues,
    onSubmit: async ({ value }) => {
      const payload: OrganisationCreatePayload = {
        name: value.name.trim(),
        type: {
          system: ORG_TYPE_SYSTEM,
          code: value.type_code.trim(),
          display: value.type_display?.trim() || null,
        },
        parent_organisation_id: parent?.id ?? null,
      }
      try {
        const created = await mutation.mutateAsync(payload)
        toast.success(t('create.success'))
        onCreated?.(created)
        onOpenChange(false)
      } catch {
        toast.error(t('error.generic'))
      }
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

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
              {t('create.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t('create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
