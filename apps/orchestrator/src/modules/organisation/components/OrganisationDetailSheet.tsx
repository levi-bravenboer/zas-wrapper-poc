import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'

import { useAffiliatedPractitionerRoles } from '../hooks'
import type { OrganisationRead } from '../schemas'

export interface OrganisationDetailSheetProps {
  open: boolean
  organisation: OrganisationRead | null
  parent: OrganisationRead | null
  onOpenChange: (open: boolean) => void
}

export function OrganisationDetailSheet({
  open,
  organisation,
  parent,
  onOpenChange,
}: OrganisationDetailSheetProps) {
  const { t } = useTranslation('organisations-admin-ui')
  const { data: roles, isLoading } = useAffiliatedPractitionerRoles(organisation?.id ?? null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('sheet.title')}</SheetTitle>
        </SheetHeader>
        {organisation && (
          <div className="flex flex-col gap-6 px-4 py-2">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('sheet.demographics')}
              </h3>
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('sheet.field.name')}</dt>
                <dd className="font-medium">{organisation.name}</dd>
                <dt className="text-muted-foreground">{t('sheet.field.type')}</dt>
                <dd>
                  <Badge variant="outline">
                    {organisation.type_display ?? organisation.type_code}
                  </Badge>
                </dd>
                <dt className="text-muted-foreground">{t('sheet.field.parent')}</dt>
                <dd>{parent ? parent.name : '—'}</dd>
              </dl>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('sheet.affiliated.title')}
              </h3>
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : roles && roles.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {roles.map((role) => (
                    // TODO(chain slot #6 patient-profile): replace practitioner_id with
                    // display name once /practitioners list endpoint exists.
                    <li
                      key={role.id}
                      className="flex items-center justify-between rounded-md border bg-card px-2 py-1.5"
                    >
                      <span className="font-mono text-xs">{role.practitioner_id}</span>
                      <Badge variant="outline">{role.code}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('sheet.affiliated.empty')}</p>
              )}
            </section>
          </div>
        )}
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('sheet.close')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
