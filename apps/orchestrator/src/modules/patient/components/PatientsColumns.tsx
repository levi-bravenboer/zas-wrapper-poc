import { type TFunction } from 'i18next'
import { Trash2 } from 'lucide-react'

import {
  defineColumn,
  type BrandedColumnDef,
  type DataTableFilter,
  type DataTableRowAction,
} from '@/components/data-table'
import { OrganisationPicker } from '@/components/pickers'
import { formatDateOrDash } from '@/lib/utils/datetime'

import type { OrganisationOption, PatientRow } from '../types'

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
      id: 'birth_date',
      header: t('columns.birthDate'),
      sortKey: 'birth_date',
      cell: (row) => formatDateOrDash(row.birth_date, locale),
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
      cell: (row) => formatDateOrDash(row.last_synced_at, locale),
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
  const labelsById = new Map(organisations.map((o) => [o.id, o.name]))
  return [
    { type: 'date-range', key: 'birth_date', label: t('filters.birthDate') },
    {
      type: 'typeahead',
      key: 'primary_organisation_id',
      label: t('filters.organisation'),
      formatValue: (id) => labelsById.get(id) ?? null,
      renderEditor: ({ value, onChange }) => (
        <OrganisationPicker
          value={value}
          onChange={(id) => onChange(id)}
          ariaLabel={t('filters.organisation')}
          placeholder={t('filters.organisation')}
          inline
        />
      ),
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
