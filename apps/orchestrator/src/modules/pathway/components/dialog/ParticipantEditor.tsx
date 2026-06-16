import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

import type { ParticipantValue } from '../../hooks/useBlockDraft'

// FHIR action.participant (role + optional specialty) editor. Resolved to
// an actual Practitioner at enrollment. NOTE: role/specialty are free text
// for now — swap to a select over the generated role/specialty value sets
// when the backend exposes them.
type Props = {
  value: ParticipantValue
  onChange: (next: ParticipantValue) => void
}

export function ParticipantEditor({ value, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const role = value?.role ?? ''
  const specialty = value?.specialty ?? ''

  const setRole = (next: string): void => {
    const trimmed = next.trim()
    // Empty role drops the whole participant — a block needs a role to have one.
    onChange(trimmed === '' ? null : { role: trimmed, specialty: value?.specialty ?? null })
  }

  const setSpecialty = (next: string): void => {
    if (!value?.role) return
    const trimmed = next.trim()
    onChange({ role: value.role, specialty: trimmed === '' ? null : trimmed })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-[--color-foreground-muted] text-xs">{t('participant.role')}</label>
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={t('participant.rolePlaceholder')}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[--color-foreground-muted] text-xs">
          {t('participant.specialty')}
        </label>
        <Input
          value={specialty}
          disabled={!value?.role}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder={t('participant.specialtyPlaceholder')}
        />
      </div>
    </div>
  )
}
