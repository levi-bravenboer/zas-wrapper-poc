import { type TFunction } from 'i18next'
import { Trash2 } from 'lucide-react'

import { defineColumn, type BrandedColumnDef } from '@/components/data-table/columns'
import { type DataTableFilter } from '@/components/data-table/DataTableToolbar'
import { type DataTableRowAction } from '@/components/data-table/types'
import { Badge } from '@/components/ui/badge'

import type { OrganisationOption, PatientRow } from '../types'

/** Belgian INSZ — see apps/backend/app/core/identifiers.py:INSZ_SYSTEM. */
const INSZ_SYSTEM = 'urn:oid:2.16.840.1.113883.2.8.4.1.1'

function findInsz(row: PatientRow): string | null {
  const hit = row.identifiers.find((i) => i.system === INSZ_SYSTEM)
  return hit ? hit.value : null
}

function formatBirthDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatUpdatedAt(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export interface PatientColumnContext {
  t: TFunction<'patients'>
  locale: string
  organisationsById: ReadonlyMap<string, OrganisationOption>
}

export function patientColumns(
  ctx: PatientColumnContext,
): ReadonlyArray<BrandedColumnDef<PatientRow>> {
  const { t, locale, organisationsById } = ctx
  return [
    defineColumn<PatientRow>({
      id: 'name',
      header: t('columns.name'),
      sortKey: 'family_name',
      sticky: true,
      cell: (row) => `${row.family_name}, ${row.given_name}`,
    }),
    defineColumn<PatientRow>({
      id: 'insz',
      header: t('columns.insz'),
      cell: (row) => {
        const insz = findInsz(row)
        return insz ? (
          <Badge variant="soft">{insz}</Badge>
        ) : (
          <span className="text-foreground-muted">—</span>
        )
      },
    }),
    defineColumn<PatientRow>({
      id: 'birth_date',
      header: t('columns.birthDate'),
      sortKey: 'birth_date',
      cell: (row) => formatBirthDate(row.birth_date, locale),
    }),
    defineColumn<PatientRow>({
      id: 'gender',
      header: t('columns.gender'),
      cell: (row) => t(`gender.${row.gender}`),
    }),
    defineColumn<PatientRow>({
      id: 'organisation',
      header: t('columns.organisation'),
      cell: (row) => organisationsById.get(row.primary_organisation_id)?.name ?? '—',
    }),
    defineColumn<PatientRow>({
      id: 'updated_at',
      header: t('columns.updatedAt'),
      sortKey: 'updated_at',
      cell: (row) => formatUpdatedAt(row.last_synced_at, locale),
    }),
  ]
}

export interface PatientFilterContext {
  t: TFunction<'patients'>
  organisations: ReadonlyArray<OrganisationOption>
}

export function patientFilters(
  ctx: PatientFilterContext,
): ReadonlyArray<DataTableFilter<PatientRow>> {
  const { t, organisations } = ctx
  return [
    { type: 'date-range', key: 'birth_date', label: t('filters.birthDate') },
    {
      type: 'select',
      key: 'primary_organisation_id',
      label: t('filters.organisation'),
      options: organisations.map((o) => ({ value: o.id, label: o.name })),
    },
  ]
}

export interface PatientRowActionsContext {
  t: TFunction<'patients'>
  onDelete: (row: PatientRow) => void
}

export function patientRowActions(
  ctx: PatientRowActionsContext,
): (row: PatientRow) => DataTableRowAction[] {
  const { t, onDelete } = ctx
  return (row) => [
    {
      label: t('actions.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      destructive: true,
      onClick: () => onDelete(row),
    },
  ]
}
