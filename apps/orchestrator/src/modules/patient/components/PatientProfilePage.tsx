import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  EntityDetailPage,
  EntityDetailSkeleton,
  EntityDetailTabs,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEntityDelete } from '@/hooks/entity'
import { api } from '@/lib/api/client'

import { softDeletePatient } from '../api'
import { usePatient } from '../hooks'
import type { OrganisationOption, PatientIdentifierRow } from '../types'

import { CareTeamSlot } from './CareTeamSlot'
import { EditPatientDialog } from './EditPatientDialog'
import { PatientDemographicsPanel } from './PatientDemographicsPanel'
import { PatientHistoryPanel } from './PatientHistoryPanel'
import { PatientIdentifiersPanel } from './PatientIdentifiersPanel'

const ORG_CACHE_STALE_MS = 5 * 60_000

async function fetchOrganisations(): Promise<OrganisationOption[]> {
  const result = await api.GET('/organisations', {})
  if (!result.data) {
    throw new Error(
      `Failed to fetch organisations (${result.response.status} ${result.response.statusText})`,
    )
  }
  return result.data.items
}

function pickInsz(identifiers: ReadonlyArray<PatientIdentifierRow>): string | null {
  const match = identifiers.find((id) => {
    if (id.use === 'official') return true
    const system = id.system?.toLowerCase() ?? ''
    return system.includes('ssin') || system.includes('insz') || system.includes('2.16.56')
  })
  return match?.value ?? null
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export interface PatientProfilePageProps {
  patientId: string
}

export function PatientProfilePage({ patientId }: PatientProfilePageProps): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const [editOpen, setEditOpen] = useState(false)

  const patientQuery = usePatient(patientId)
  const organisationsQuery = useQuery({
    queryKey: ['organisations', 'list'] as const,
    queryFn: fetchOrganisations,
    staleTime: ORG_CACHE_STALE_MS,
  })

  const organisationsById = useMemo(
    () => new Map((organisationsQuery.data ?? []).map((o) => [o.id, o])),
    [organisationsQuery.data],
  )

  const patient = patientQuery.data
  const fullName = patient ? `${patient.family_name}, ${patient.given_name}` : ''

  const deleteAction = useEntityDelete({
    entityName: fullName,
    listPath: { to: '/patients' },
    mutate: () => softDeletePatient(patientId),
    successMessage: t('delete.toast.success'),
    errorMessage: t('delete.toast.error'),
  })

  if (patientQuery.isLoading) {
    return <EntityDetailSkeleton />
  }

  if (patientQuery.error) {
    return <EntityErrorCard onRetry={() => void patientQuery.refetch()} />
  }

  if (!patient) {
    return <EntityNotFound backTo={{ to: '/patients' }} />
  }

  const insz = pickInsz(patient.identifiers ?? [])
  const organisation = organisationsById.get(patient.primary_organisation_id)

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      {insz ? (
        <Badge variant="default">
          {t('header.insz')}: <span className="ml-1 font-mono">{insz}</span>
        </Badge>
      ) : (
        <Badge variant="soft">{t('header.noInsz')}</Badge>
      )}
      <span className="text-sm text-muted-foreground">
        {t('header.born', { date: formatDate(patient.birth_date, i18n.language) })}
      </span>
      <Badge variant="soft">{organisation?.name ?? t('header.unknownOrg')}</Badge>
    </div>
  )

  const actions = (
    <div className="flex items-center gap-2">
      <Button onClick={() => setEditOpen(true)}>{t('edit.trigger')}</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('header.actions')}>
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            {t('edit.trigger')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => deleteAction.open()}
            className="text-destructive focus:text-destructive"
          >
            {t('delete.trigger')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <>
      <EntityDetailPage
        title={fullName}
        subtitle={subtitle}
        back={{ to: '/patients' }}
        actions={actions}
        body={
          <EntityDetailTabs
            tabs={[
              {
                value: 'overview',
                label: t('tabs.overview'),
                content: (
                  <div className="flex flex-col gap-3">
                    <PatientDemographicsPanel patient={patient} organisation={organisation} />
                    <PatientIdentifiersPanel patient={patient} />
                  </div>
                ),
              },
              {
                value: 'careTeam',
                label: t('tabs.careTeam'),
                content: <CareTeamSlot patientId={patient.id} />,
              },
              {
                value: 'history',
                label: t('tabs.history'),
                content: <PatientHistoryPanel patient={patient} />,
              },
            ]}
          />
        }
      />
      <EditPatientDialog patient={patient} open={editOpen} onOpenChange={setEditOpen} />
      {deleteAction.dialog}
    </>
  )
}
