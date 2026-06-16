import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateOrDash } from '@/lib/utils/datetime'

import { usePatient } from '../hooks'
import type { PatientIdentifierRow } from '../types'

function pickInsz(identifiers: ReadonlyArray<PatientIdentifierRow>): string | null {
  const match = identifiers.find((id) => {
    if (id.use === 'official') return true
    const system = id.system?.toLowerCase() ?? ''
    return system.includes('ssin') || system.includes('insz') || system.includes('2.16.56')
  })
  return match?.value ?? null
}

function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null
  const birth = new Date(iso)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDelta = now.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1
  return age
}

function Fact({ label, children }: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

/** At-a-glance patient identity widget for entity detail surfaces: avatar +
 *  name, key demographics (birth date/age, gender, INSZ), and a link to the
 *  full patient. Fetches the patient by id. */
export function PatientSummaryCard({ patientId }: { patientId: string }): ReactElement {
  const { t, i18n } = useTranslation(['patient-profile'])
  const query = usePatient(patientId)
  const patient = query.data

  if (query.isLoading || !patient) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    )
  }

  const fullName = `${patient.family_name}, ${patient.given_name}`
  const age = ageFromBirthDate(patient.birth_date)
  const insz = pickInsz(patient.identifiers ?? [])

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 bg-gradient-to-br from-primary-soft/40 to-transparent py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <PersonAvatar size="lg" name={fullName} tintId={patient.id} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-lg font-semibold text-foreground">{fullName}</span>
              <span className="text-xs text-foreground-muted">
                {t(`gender.${patient.gender}`, { defaultValue: patient.gender })}
              </span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/patients/$patientId" params={{ patientId: patient.id }}>
              {t('openPatient', { defaultValue: 'Open patiënt' })}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label={t('field.birthDate', { defaultValue: 'Geboortedatum' })}>
            {age !== null
              ? `${formatDateOrDash(patient.birth_date ?? null, i18n.language)} (${age} j.)`
              : formatDateOrDash(patient.birth_date ?? null, i18n.language)}
          </Fact>
          <Fact label="INSZ">
            {insz ? <span className="font-mono">{insz}</span> : '—'}
          </Fact>
          <Fact label={t('field.source', { defaultValue: 'Bron' })}>
            <Badge variant="soft">{patient.source}</Badge>
          </Fact>
        </div>
      </CardContent>
    </Card>
  )
}
