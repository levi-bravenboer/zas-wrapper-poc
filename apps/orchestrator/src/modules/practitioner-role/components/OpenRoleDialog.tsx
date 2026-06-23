import { useEffect, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { OrganisationPicker, PractitionerPicker } from '@/components/pickers'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

import { ROLE_CODES, SPECIALTY_CODES } from '../constants'
import { useOpenPractitionerRole } from '../hooks'
import type { PractitionerRoleCreatePayload } from '../schemas'

import { openRoleFormSchema, type OpenRoleFormValues } from './practitionerRoleForm.schema'

export interface OpenRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPractitionerId?: string | null
  initialOrganisationId?: string | null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OpenRoleDialog({
  open,
  onOpenChange,
  initialPractitionerId,
  initialOrganisationId,
}: OpenRoleDialogProps): ReactElement {
  const { t } = useTranslation('practitioner-roles-admin-ui')
  const mutation = useOpenPractitionerRole()

  const defaults: OpenRoleFormValues = {
    practitioner_id: initialPractitionerId ?? '',
    organisation_id: initialOrganisationId ?? '',
    code: 'gp',
    specialty: '',
    is_primary: false,
    period_start: todayIso(),
  }

  const { form, isSubmitting, submit, reset } = useEntityForm<OpenRoleFormValues>({
    schema: openRoleFormSchema,
    defaultValues: defaults,
    onSubmit: async (value) => {
      try {
        // The picker yields a User id; PractitionerRole binds a Practitioner id.
        const { data: practitioner } = await api.GET('/practitioners/{user_id}', {
          params: { path: { user_id: value.practitioner_id } },
        })
        if (!practitioner) throw new Error('practitioner not found for user')
        const payload: PractitionerRoleCreatePayload = {
          practitioner_id: practitioner.id,
          organisation_id: value.organisation_id,
          code: value.code,
          specialty: value.specialty.trim() === '' ? null : value.specialty.trim(),
          is_primary: value.is_primary,
          period_start: new Date(value.period_start).toISOString(),
        }
        await mutation.mutateAsync(payload)
      } catch (err) {
        toast.error(t('toast.open_failed'))
        throw err
      }
    },
    onSuccess: () => {
      toast.success(t('toast.opened'))
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
          <DialogTitle>{t('open.title')}</DialogTitle>
          <DialogDescription>{t('open.sub')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="practitioner_id">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label>{t('field.practitioner')}</Label>
                <PractitionerPicker
                  value={field.state.value || null}
                  onChange={(id) => field.handleChange(id ?? '')}
                  ariaLabel={t('field.practitioner')}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="organisation_id">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label>{t('field.organisation')}</Label>
                <OrganisationPicker
                  value={field.state.value || null}
                  onChange={(id) => field.handleChange(id ?? '')}
                  ariaLabel={t('field.organisation')}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="code">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('field.code')}</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as OpenRoleFormValues['code'])}
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
                <Select
                  value={field.state.value === '' ? 'none' : field.state.value}
                  onValueChange={(v) => field.handleChange(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('specialty_option.none')}</SelectItem>
                    {SPECIALTY_CODES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`specialty_option.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="period_start">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={field.name}>{t('field.period_start')}</Label>
                <Input
                  id={field.name}
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
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
              {t('open.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
