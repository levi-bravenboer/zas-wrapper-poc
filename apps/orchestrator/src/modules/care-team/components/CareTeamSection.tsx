import { MoreHorizontal, Plus } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/utils/datetime'

import type { CareTeamRow, ParticipantRow } from '../types'

import { AddParticipantDialog } from './AddParticipantDialog'
import { ChangeRoleDialog } from './ChangeRoleDialog'
import { CloseTeamConfirm } from './CloseTeamConfirm'
import { RemoveParticipantConfirm } from './RemoveParticipantConfirm'

export interface CareTeamSectionProps {
  team: CareTeamRow
  patientId: string
  userNames: ReadonlyMap<string, string>
  roleLabels: ReadonlyMap<string, string>
}

export function CareTeamSection({
  team,
  patientId,
  userNames,
  roleLabels,
}: CareTeamSectionProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const [showHistory, setShowHistory] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [changingRole, setChangingRole] = useState<ParticipantRow | null>(null)
  const [removing, setRemoving] = useState<ParticipantRow | null>(null)

  const openParticipants = team.participants.filter((p) => !p.period_end)
  const closedParticipants = team.participants.filter((p) => !!p.period_end)

  const formatPeriod = (p: ParticipantRow) => {
    const start = formatDate(p.period_start)
    const end = p.period_end ? formatDate(p.period_end) : ''
    return `${start} \u2192 ${end}`
  }

  const renderRow = (p: ParticipantRow, showActions: boolean) => (
    <div
      key={p.id}
      className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-2 last:border-b-0"
    >
      <span className="truncate text-sm font-medium">
        {userNames.get(p.user_id) ?? p.user_id?.slice(0, 8) ?? '\u2014'}
      </span>
      <Badge variant="outline">{t(`roleInCare.${p.role_in_care}`)}</Badge>
      <span className="truncate text-sm text-muted-foreground">
        {p.acting_as_practitioner_role_id
          ? (roleLabels.get(p.acting_as_practitioner_role_id) ?? '\u2014')
          : t('participant.noActingAs')}
      </span>
      <span className="text-xs text-muted-foreground">{formatPeriod(p)}</span>
      {showActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setChangingRole(p)}>
              {t('participant.changeRole')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRemoving(p)} className="text-destructive">
              {t('participant.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span />
      )}
    </div>
  )

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {team.name ?? team.category ?? team.id.slice(0, 8)}
          </h3>
          {team.category && <Badge variant="outline">{team.category}</Badge>}
          <Badge variant={team.status === 'active' ? 'default' : 'soft'}>
            {t(`team.${team.status}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(team.period_start)}
            {team.period_end ? ` \u2192 ${formatDate(team.period_end)}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 size-4" />
            {t('participant.addParticipant')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCloseOpen(true)} className="text-destructive">
                {t('team.close')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="divide-y divide-border">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{t('participant.name')}</span>
          <span>{t('participant.role')}</span>
          <span>{t('participant.actingAs')}</span>
          <span>{t('participant.period')}</span>
          <span />
        </div>
        {openParticipants.length === 0 ? (
          <div className="px-4 py-3 text-center text-sm text-muted-foreground">{t('empty')}</div>
        ) : (
          openParticipants.map((p) => renderRow(p, true))
        )}
      </div>

      {closedParticipants.length > 0 && (
        <div className="border-t border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground"
          >
            {showHistory ? t('hideHistory') : t('showHistory')}
          </Button>
          {showHistory && (
            <div className="mt-1">{closedParticipants.map((p) => renderRow(p, false))}</div>
          )}
        </div>
      )}

      {addOpen && (
        <AddParticipantDialog
          open={addOpen}
          careTeamId={team.id}
          patientId={patientId}
          onOpenChange={setAddOpen}
        />
      )}
      {changingRole && (
        <ChangeRoleDialog
          open
          careTeamId={team.id}
          patientId={patientId}
          participant={changingRole}
          onOpenChange={(open) => {
            if (!open) setChangingRole(null)
          }}
        />
      )}
      {removing && (
        <RemoveParticipantConfirm
          open
          careTeamId={team.id}
          patientId={patientId}
          userId={removing.user_id}
          displayName={userNames.get(removing.user_id) ?? removing.user_id?.slice(0, 8) ?? '\u2014'}
          onOpenChange={(open) => {
            if (!open) setRemoving(null)
          }}
        />
      )}
      {closeOpen && (
        <CloseTeamConfirm
          open
          careTeamId={team.id}
          patientId={patientId}
          teamName={team.name ?? team.category ?? team.id.slice(0, 8)}
          onOpenChange={setCloseOpen}
        />
      )}
    </div>
  )
}
