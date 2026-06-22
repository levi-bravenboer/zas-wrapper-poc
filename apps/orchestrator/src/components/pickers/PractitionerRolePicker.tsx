'use client'

import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import type { ListQuery } from '@/lib/query/paginated'
import { useOrganisations } from '@/modules/organisation/hooks'
import { PRACTITIONER_ROLES_LIST_PATH } from '@/modules/practitioner-role/keys'
import type { PractitionerRoleRead } from '@/modules/practitioner-role/schemas'

import { PickerCombobox } from './PickerCombobox'
import { usePickerSelection } from './usePickerSelection'

export interface PractitionerRolePickerProps {
  practitionerId: string | null
  value: string | null
  onChange: (roleId: string | null, role: PractitionerRoleRead | null) => void
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  loadingLabel?: string
  ariaLabel?: string
}

const PAGE_SIZE = 50

export function PractitionerRolePicker({
  practitionerId,
  value,
  onChange,
  disabled,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  ariaLabel,
}: PractitionerRolePickerProps): ReactElement {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')

  const query = useMemo(
    (): ListQuery => ({
      page: 1,
      page_size: PAGE_SIZE,
      q: search.trim() || null,
      ...(practitionerId
        ? { filters: { practitioner_id: { op: 'eq' as const, value: practitionerId } } }
        : {}),
    }),
    [practitionerId, search],
  )

  const { data, isLoading } = usePaginatedQuery<PractitionerRoleRead>(
    PRACTITIONER_ROLES_LIST_PATH,
    query,
    { enabled: !!practitionerId },
  )

  const items = data?.items ?? []
  const openItems = useMemo(() => items.filter((r) => !r.period_end), [items])
  const selected = usePickerSelection<PractitionerRoleRead>(
    PRACTITIONER_ROLES_LIST_PATH,
    value,
    openItems,
    (r) => r.id,
  )

  const { data: orgs } = useOrganisations()
  const orgMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const org of orgs ?? []) m.set(org.id, org.name)
    return m
  }, [orgs])

  const getLabel = (role: PractitionerRoleRead): string => {
    const orgName = orgMap.get(role.organisation_id) ?? '…'
    const primary = role.is_primary ? ` ${t('pickers.role.primarySuffix')}` : ''
    return `${role.code} @ ${orgName}${primary}`
  }

  return (
    <PickerCombobox<PractitionerRoleRead>
      value={value}
      items={openItems}
      getId={(r) => r.id}
      getLabel={getLabel}
      renderItem={(r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{getLabel(r)}</span>
          {r.specialty && (
            <span className="truncate text-xs text-muted-foreground">{r.specialty}</span>
          )}
        </div>
      )}
      selected={selected}
      search={search}
      onSearchChange={setSearch}
      onSelect={(r) => onChange(r.id, r)}
      placeholder={placeholder ?? t('pickers.role.placeholder')}
      searchPlaceholder={searchPlaceholder ?? t('pickers.role.search')}
      emptyLabel={emptyLabel ?? t('pickers.role.empty')}
      loadingLabel={loadingLabel ?? t('pickers.loading')}
      isLoading={isLoading}
      disabled={disabled || !practitionerId}
      ariaLabel={ariaLabel}
    />
  )
}
