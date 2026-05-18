import { useEffect, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
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

import { ROLE_CODES } from '../constants'
import { useUpdatePractitionerRole } from '../hooks'
import type { PractitionerRoleRead, PractitionerRoleUpdatePayload } from '../schemas'

import { editRoleFormSchema, type EditRoleFormValues } from './practitionerRoleForm.schema'

export interface EditRoleDialogProps {
  open: boolean
  role: PractitionerRoleRead | null
  onOpenChange: (open: boolean) => void
}

export function EditRoleDialog({ open, role, onOpenChange }: EditRoleDialogProps): ReactElement {
  const { t } = useTranslation('practitioner-roles-admin-ui')
  const mutation = useUpdatePractitionerRole()

  const defaults: EditRoleFormValues = {
    code: role?.code ?? 'gp',
    specialty: role?.specialty ?? '',
    is_primary: role?.is_primary ?? false,
  }

  const { form, isSubmitting, submit, reset } = useEntityForm<EditRoleFormValues>({
    schema: editRoleFormSchema,
    defaultValues: defaults,
    onSubmit: async (value) => {
      if (!role) return
      const payload: PractitionerRoleUpdatePayload = {
        code: value.code,
        specialty: value.specialty.trim() === '' ? null : value.specialty.trim(),
        is_primary: value.is_primary,
      }
      try {
        await mutation.mutateAsync({ roleId: role.id, payload })
      } catch (err) {
        toast.error(t('toast.update_failed'))
        throw err
      }
    },
    onSuccess: () => {
      toast.success(t('toast.updated'))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) reset()
  }, [open, role?.id, reset])

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
          <form.Field name="code">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('field.code')}</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as EditRoleFormValues['code'])}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`code.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="specialty">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('field.specialty')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('field.specialty_placeholder')}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="is_primary">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(v === true)}
                />
                <span>{t('field.is_primary')}</span>
              </label>
            )}
          </form.Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
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
