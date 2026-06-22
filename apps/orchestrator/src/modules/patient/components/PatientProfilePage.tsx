import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  EntityDetailPage,
  EntityDetailSkeleton,
  EntityDetailTabs,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { EmptyState } from '@/components/states/EmptyState'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { PathwayTimeline } from '@/modules/patient-pathway/components/PathwayTimeline'
import { ZorgpadTab } from '@/modules/patient-pathway/components/ZorgpadTab'

import { usePatient } from '../hooks'
import type { OrganisationOption, PatientIdentifierRow } from '../types'

import { BreakGlassPrompt } from './BreakGlassPrompt'
import { CareTeamSlot } from './CareTeamSlot'
import { env } from '@/config/env'

import { MeasurementCharts } from './MeasurementCharts'
import { MeasurementReplica } from './replica/MeasurementReplica'
import { PatientAppointmentsTab } from './PatientAppointmentsTab'
import { PatientCollaborationTab } from './PatientCollaborationTab'
import { PatientKebab } from './PatientKebab'
import { PatientOverviewTab } from './PatientOverviewTab'

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

export interface PatientProfilePageProps {
  patientId: string
}

/**
 * Standalone patient detail per design.md D-PATIENTS-ROUTE: `<EntityDetailPage>`
 * chrome with two clinical tabs (Metingen + Labresultaten, both `<EmptyState>`
 * v1), `<CareTeamSlot>` as a header-adjacent card, and audit history behind
 * the kebab → `Geschiedenis` dialog. Serves admin/users links, care-team
 * links, and any non-task-context entry.
 */
export function PatientProfilePage({ patientId }: PatientProfilePageProps): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const [activeTab, setActiveTab] = useState('overview')

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

  if (patientQuery.isLoading) {
    return <EntityDetailSkeleton />
  }

  if (patientQuery.error) {
    // 404 = existence-hiding deny (no relation) — offer break-glass (REQ-NON-8)
    if (isApiError(patientQuery.error) && patientQuery.error.status === 404 && patientId) {
      return (
        <BreakGlassPrompt patientId={patientId} onGranted={() => void patientQuery.refetch()} />
      )
    }
    return <EntityErrorCard onRetry={() => void patientQuery.refetch()} />
  }

  if (!patient) {
    return <EntityNotFound backTo={{ to: '/tasks' }} />
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
        {t('header.born', { date: formatDateOrDash(patient.birth_date, i18n.language) })}
      </span>
      <Badge variant="soft">{organisation?.name ?? t('header.unknownOrg')}</Badge>
    </div>
  )

  return (
    <EntityDetailPage
      title={fullName}
      subtitle={subtitle}
      back={{ to: '/tasks' }}
      actions={<PatientKebab patient={patient} />}
      body={
        <>
          <PathwayTimeline patientId={patient.id} />
          <EntityDetailTabs
            value={activeTab}
            onValueChange={setActiveTab}
            tabs={[
              {
                value: 'overview',
                label: t('tabs.overview'),
                content: <PatientOverviewTab patientId={patient.id} onNavigate={setActiveTab} />,
              },
              {
                value: 'pathway',
                label: t('tabs.pathway'),
                content: <ZorgpadTab patientId={patient.id} />,
              },
              {
                value: 'measurements',
                label: t('tabs.measurements'),
                content: env.LUSCII_METINGEN_REPLICA ? (
                  <MeasurementReplica patientId={patient.id} />
                ) : (
                  <MeasurementCharts patientId={patient.id} />
                ),
              },
              {
                value: 'lab_results',
                label: t('tabs.lab_results'),
                content: (
                  <EmptyState
                    icon={FlaskConical}
                    title={t('tabs.empty.lab_results.title')}
                    body={t('tabs.empty.lab_results.body')}
                  />
                ),
              },
              {
                value: 'appointments',
                label: t('tabs.appointments.label'),
                content: <PatientAppointmentsTab patientId={patient.id} />,
              },
              {
                value: 'zorgteam',
                label: t('tabs.zorgteam'),
                content: <CareTeamSlot patientId={patient.id} />,
              },
              {
                value: 'collaboration',
                label: t('tabs.collaboration'),
                content: <PatientCollaborationTab patientId={patient.id} />,
              },
            ]}
          />
        </>
      }
    />
  )
}
