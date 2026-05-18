'use client'

import { useMemo, useState, type ReactElement } from 'react'

import { useOrganisations } from '@/modules/organisation/hooks'
import type { OrganisationRead } from '@/modules/organisation/schemas'

import { PickerCombobox } from './PickerCombobox'

export interface OrganisationPickerProps {
  value: string | null
  onChange: (organisationId: string | null, organisation: OrganisationRead | null) => void
  disabledIds?: ReadonlyArray<string>
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  loadingLabel?: string
  disabled?: boolean
  ariaLabel?: string
  /** Filter to a subtree (the given id and all its descendants). */
  rootId?: string
}

const PATH_SEP = ' / '

function buildPathMap(orgs: ReadonlyArray<OrganisationRead>): Map<string, string> {
  const byId = new Map<string, OrganisationRead>()
  for (const org of orgs) byId.set(org.id, org)
  const cache = new Map<string, string>()
  const visit = (id: string, stack: ReadonlySet<string>): string => {
    const cached = cache.get(id)
    if (cached) return cached
    const node = byId.get(id)
    if (!node) return ''
    if (stack.has(id)) return node.name
    const parentId: string | null = node.parent_organisation_id
    const path =
      parentId && byId.has(parentId)
        ? `${visit(parentId, new Set([...stack, id]))}${PATH_SEP}${node.name}`
        : node.name
    cache.set(id, path)
    return path
  }
  for (const org of orgs) visit(org.id, new Set())
  return cache
}

function isDescendantOf(
  org: OrganisationRead,
  rootId: string,
  byId: ReadonlyMap<string, OrganisationRead>,
): boolean {
  let cursor: OrganisationRead | undefined = org
  const seen = new Set<string>()
  while (cursor) {
    if (cursor.id === rootId) return true
    if (seen.has(cursor.id)) return false
    seen.add(cursor.id)
    const parentId: string | null = cursor.parent_organisation_id
    cursor = parentId ? byId.get(parentId) : undefined
  }
  return false
}

export function OrganisationPicker({
  value,
  onChange,
  disabledIds,
  placeholder = 'Selecteer organisatie',
  searchPlaceholder = 'Zoek organisatie',
  emptyLabel = 'Geen organisaties gevonden',
  loadingLabel = 'Laden…',
  disabled,
  ariaLabel,
  rootId,
}: OrganisationPickerProps): ReactElement {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useOrganisations()

  const { pathMap, items, selected } = useMemo(() => {
    const all = data ?? []
    const byId = new Map<string, OrganisationRead>(all.map((o) => [o.id, o]))
    const inScope = rootId ? all.filter((o) => isDescendantOf(o, rootId, byId)) : all
    const paths = buildPathMap(all)
    const term = search.trim().toLowerCase()
    const filtered = term
      ? inScope.filter((o) => (paths.get(o.id) ?? o.name).toLowerCase().includes(term))
      : inScope
    const sorted = [...filtered].sort((a, b) =>
      (paths.get(a.id) ?? a.name).localeCompare(paths.get(b.id) ?? b.name),
    )
    return {
      pathMap: paths,
      items: sorted,
      selected: value ? (byId.get(value) ?? null) : null,
    }
  }, [data, rootId, search, value])

  const getLabel = (org: OrganisationRead) => pathMap.get(org.id) ?? org.name

  return (
    <PickerCombobox<OrganisationRead>
      value={value}
      items={items}
      getId={(o) => o.id}
      getLabel={getLabel}
      renderItem={(o) => <span className="truncate">{getLabel(o)}</span>}
      selected={selected}
      search={search}
      onSearchChange={setSearch}
      onSelect={(o) => onChange(o.id, o)}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyLabel={emptyLabel}
      loadingLabel={loadingLabel}
      isLoading={isLoading}
      disabled={disabled}
      disabledIds={disabledIds}
      ariaLabel={ariaLabel}
    />
  )
}
