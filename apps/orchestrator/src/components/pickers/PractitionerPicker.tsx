'use client'

import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { USERS_LIST_PATH } from '@/modules/user/keys'
import type { UserRow } from '@/modules/user/schemas'

import { PickerCombobox } from './PickerCombobox'
import { usePickerSelection } from './usePickerSelection'

export interface PractitionerPickerProps {
  value: string | null
  onChange: (userId: string | null, user: UserRow | null) => void
  disabledIds?: ReadonlyArray<string>
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  loadingLabel?: string
  disabled?: boolean
  pageSize?: number
  ariaLabel?: string
  /** Defaults to `true` (only users with a Practitioner row materialised). */
  hasPractitioner?: boolean
  /** Render the Command body inline (no Popover/Trigger). */
  inline?: boolean
}

const DEFAULT_PAGE_SIZE = 50

/**
 * Picker for users that have a `Practitioner` row materialised. Rides the
 * additive `filter[has_practitioner]=true|false` envelope on `GET /users`.
 */
export function PractitionerPicker({
  value,
  onChange,
  disabledIds,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  disabled,
  pageSize = DEFAULT_PAGE_SIZE,
  ariaLabel,
  hasPractitioner = true,
  inline,
}: PractitionerPickerProps): ReactElement {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const query = useMemo(
    () => ({
      page: 1,
      page_size: pageSize,
      q: search.trim() ? search.trim() : null,
      filters: { has_practitioner: { op: 'eq' as const, value: hasPractitioner } },
    }),
    [hasPractitioner, pageSize, search],
  )

  const { data, isLoading } = usePaginatedQuery<UserRow>(USERS_LIST_PATH, query)
  const items = data?.items ?? []
  const selected = usePickerSelection<UserRow>(USERS_LIST_PATH, value, items, (u) => u.id)

  return (
    <PickerCombobox<UserRow>
      value={value}
      items={items}
      getId={(u) => u.id}
      getLabel={(u) => u.display_name}
      renderItem={(u) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{u.display_name}</span>
          <span className="truncate text-xs text-muted-foreground">{u.email}</span>
        </div>
      )}
      selected={selected}
      search={search}
      onSearchChange={setSearch}
      onSelect={(u) => onChange(u.id, u)}
      placeholder={placeholder ?? t('pickers.practitioner.placeholder')}
      searchPlaceholder={searchPlaceholder ?? t('pickers.practitioner.search')}
      emptyLabel={emptyLabel ?? t('pickers.practitioner.empty')}
      loadingLabel={loadingLabel ?? t('pickers.loading')}
      isLoading={isLoading}
      disabled={disabled}
      disabledIds={disabledIds}
      ariaLabel={ariaLabel}
      inline={inline}
    />
  )
}
