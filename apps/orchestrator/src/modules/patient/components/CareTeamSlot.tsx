import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { usePatientCareTeams } from '../hooks'

export interface CareTeamSlotProps {
  patientId: string
}

export function CareTeamSlot({ patientId }: CareTeamSlotProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const { data, isLoading, error } = usePatientCareTeams(patientId)
  const teams = data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('careTeam.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t('careTeam.soon')}
        </p>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('careTeam.current')}
          </h3>

          {error ? (
            <p className="text-sm text-destructive">{t('careTeam.loadFailed')}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">{t('state.loading')}</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('careTeam.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {team.name ?? team.category ?? team.id}
                  </span>
                  <Badge variant={team.status === 'active' ? 'default' : 'soft'}>
                    {team.status}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t('careTeam.participants', { count: team.participants.length })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
