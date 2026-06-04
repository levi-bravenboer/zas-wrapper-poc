import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useOrganisations } from '@/modules/organisation/hooks'
import { usePatientCareTeams } from '@/modules/patient/hooks'
import { PRACTITIONER_ROLES_LIST_PATH } from '@/modules/practitioner-role/keys'
import type { PractitionerRoleRead } from '@/modules/practitioner-role/schemas'
import { USERS_LIST_PATH } from '@/modules/user/keys'
import type { UserRow } from '@/modules/user/schemas'

import { CareTeamSection } from './CareTeamSection'
import { CreateCareTeamDialog } from './CreateCareTeamDialog'

export interface CareTeamEditorProps {
  patientId: string
}

export function CareTeamEditor({ patientId }: CareTeamEditorProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const { data, isLoading, error } = usePatientCareTeams(patientId)
  const teams = data ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const activeTeams = teams.filter((t) => !t.period_end)
  const closedTeams = teams.filter((t) => !!t.period_end)

  // Resolve user display names for participant rows
  const userQuery = usePaginatedQuery<UserRow>(USERS_LIST_PATH, { page: 1, page_size: 100 })
  const userNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of userQuery.data?.items ?? []) m.set(u.id, u.display_name)
    return m
  }, [userQuery.data])

  // Resolve practitioner role labels for acting-as column
  const rolesQuery = usePaginatedQuery<PractitionerRoleRead>(PRACTITIONER_ROLES_LIST_PATH, {
    page: 1,
    page_size: 100,
  })
  const { data: orgs } = useOrganisations()
  const roleLabels = useMemo(() => {
    const orgMap = new Map<string, string>()
    for (const org of orgs ?? []) orgMap.set(org.id, org.name)
    const m = new Map<string, string>()
    for (const role of rolesQuery.data?.items ?? []) {
      const orgName = orgMap.get(role.organisation_id) ?? '…'
      m.set(role.id, `${role.code} @ ${orgName}`)
    }
    return m
  }, [rolesQuery.data, orgs])

  if (error) {
    return <p className="text-sm text-destructive">{t('loadFailed')}</p>
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-4" />
          {t('newTeam')}
        </Button>
        {createOpen && (
          <CreateCareTeamDialog open patientId={patientId} onOpenChange={setCreateOpen} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-4" />
          {t('newTeam')}
        </Button>
      </div>

      {activeTeams.map((team) => (
        <CareTeamSection
          key={team.id}
          team={team}
          patientId={patientId}
          userNames={userNames}
          roleLabels={roleLabels}
        />
      ))}

      {closedTeams.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="gap-1 text-muted-foreground"
          >
            {historyOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {t('history')} ({closedTeams.length})
          </Button>
          {historyOpen &&
            closedTeams.map((team) => (
              <CareTeamSection
                key={team.id}
                team={team}
                patientId={patientId}
                userNames={userNames}
                roleLabels={roleLabels}
              />
            ))}
        </div>
      )}

      <CreateCareTeamDialog open={createOpen} patientId={patientId} onOpenChange={setCreateOpen} />
    </div>
  )
}
