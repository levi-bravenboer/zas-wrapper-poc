import { useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEntityDelete } from '@/hooks/entity'
import { tasksListKeyPrefix } from '@/modules/tasks/keys'

import { patientsListKeyPrefix, softDeletePatient } from '../api'
import type { PatientRow } from '../types'

import { EditPatientDialog } from './EditPatientDialog'
import { PatientHistoryPanel } from './PatientHistoryPanel'

export type PatientKebabProps = {
  patient: PatientRow
}

/**
 * Action cluster for a patient detail surface (task detail route + standalone
 * patient route): primary `Bewerken` button + kebab with `Bewerken` /
 * `Verwijderen` / `Geschiedenis` entries. Owns its dialogs (edit, delete
 * confirm, history) so hosts just drop it into an `actions` slot.
 */
export function PatientKebab({ patient }: PatientKebabProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const fullName = `${patient.family_name}, ${patient.given_name}`
  const deleteAction = useEntityDelete({
    entityName: fullName,
    listPath: { to: '/tasks' },
    mutate: async () => {
      await softDeletePatient(patient.id)
      // The task rail stays mounted across the navigate back to /tasks —
      // stale task items for the deleted patient must drop immediately.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksListKeyPrefix }),
        queryClient.invalidateQueries({ queryKey: patientsListKeyPrefix }),
      ])
    },
    successMessage: t('delete.toast.success'),
    errorMessage: t('delete.toast.error'),
  })

  return (
    <>
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
            <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
              {t('kebab.history')}
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

      <EditPatientDialog patient={patient} open={editOpen} onOpenChange={setEditOpen} />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('kebab.historyDialogTitle')}</DialogTitle>
          </DialogHeader>
          <PatientHistoryPanel patient={patient} />
        </DialogContent>
      </Dialog>
      {deleteAction.dialog}
    </>
  )
}
