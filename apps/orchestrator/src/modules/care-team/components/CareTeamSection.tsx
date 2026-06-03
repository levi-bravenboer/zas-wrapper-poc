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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  const renderParticipantRows = (
    participants: ParticipantRow[],
    showActions: boolean,
  ) =>
    participants.map((p) => (
      <TableRow key={p.id}>
        <TableCell className="font-medium">
          {userNames.get(p.user_id) ?? p.user_id?.slice(0, 8) ?? '\u2014'}
        </TableCell>
        <TableCell>
          <Badge variant="outline">{t(`roleInCare.${p.role_in_care}`)}</Badge>
        </TableCell>
        <TableCell>
          {p.acting_as_practitioner_role_id
            ? (roleLabels.get(p.acting_as_practitioner_role_id) ?? '\u2014')
            : t('participant.noActingAs')}
        </TableCell>
        <TableCell className="text-muted-foreground">{formatPeriod(p)}</TableCell>
        {showActions && (
          <TableCell className="w-10">
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
                <DropdownMenuItem
                  onClick={() => setRemoving(p)}
                  className="text-destructive"
                >
                  {t('participant.remove')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        )}
      </TableRow>
    ))

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {team.name ?? team.category ?? team.id.slice(0, 8)}
          </h3>
          {team.category && (
            <Badge variant="outline">{team.category}</Badge>
          )}
          <Badge variant={team.status === 'active' ? 'default' : 'secondary'}>
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
              <DropdownMenuItem
                onClick={() => setCloseOpen(true)}
                className="text-destructive"
              >
                {t('team.close')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('participant.name')}</TableHead>
            <TableHead>{t('participant.role')}</TableHead>
            <TableHead>{t('participant.actingAs')}</TableHead>
            <TableHead>{t('participant.period')}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {openParticipants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            renderParticipantRows(openParticipants, true)
          )}
        </TableBody>
      </Table>

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
            <Table>
              <TableBody>
                {renderParticipantRows(closedParticipants, false)}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <AddParticipantDialog
        open={addOpen}
        careTeamId={team.id}
        patientId={patientId}
        onOpenChange={setAddOpen}
      />
      <ChangeRoleDialog
        open={!!changingRole}
        careTeamId={team.id}
        patientId={patientId}
        participant={changingRole}
        onOpenChange={(open) => { if (!open) setChangingRole(null) }}
      />
      {removing && (
        <RemoveParticipantConfirm
          open
          careTeamId={team.id}
          patientId={patientId}
          userId={removing.user_id}
          displayName={userNames.get(removing.user_id) ?? removing.user_id.slice(0, 8)}
          onOpenChange={(open) => { if (!open) setRemoving(null) }}
        />
      )}
      <CloseTeamConfirm
        open={closeOpen}
        careTeamId={team.id}
        patientId={patientId}
        teamName={team.name ?? team.category ?? team.id.slice(0, 8)}
        onOpenChange={setCloseOpen}
      />
    </div>
  )
}
