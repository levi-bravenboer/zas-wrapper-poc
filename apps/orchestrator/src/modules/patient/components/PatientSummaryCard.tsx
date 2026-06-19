import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Route } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { useCareTeamLead } from '@/modules/care-team/hooks'
import { useActiveEnrollmentGlance, type EnrollmentGlance } from '@/modules/patient-pathway/hooks'

import { usePatient } from '../hooks'
import { ageFromBirthDate, pickInsz } from '../patientFacts'

function Fact({
  label,
  children,
}: {
  label: string
  children: ReactElement | string
}): ReactElement {
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
  const glance = useActiveEnrollmentGlance(patientId)
  const lead = useCareTeamLead(patientId)

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
          <Fact label="INSZ">{insz ? <span className="font-mono">{insz}</span> : '—'}</Fact>
          {lead ? (
            <Fact label={t('field.treatingClinician', { defaultValue: 'Hoofdbehandelaar' })}>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <PersonAvatar
                  size="sm"
                  name={lead.displayName}
                  tintId={lead.userId}
                  person={{ kind: 'user', id: lead.userId }}
                />
                <span className="truncate">{lead.displayName}</span>
              </span>
            </Fact>
          ) : null}
        </div>

        {glance ? <ZorgpadGlance glance={glance} /> : null}
      </CardContent>
    </Card>
  )
}

function ZorgpadGlance({ glance }: { glance: EnrollmentGlance }): ReactElement {
  const { t } = useTranslation(['patient-profile'])
  const pct = glance.total > 0 ? Math.round((glance.done / glance.total) * 100) : 0
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/50 pt-3">
      <span className="text-[11px] uppercase tracking-wide text-foreground-muted">
        {t('field.pathway', { defaultValue: 'Zorgpad' })}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <Route className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate text-sm font-medium text-foreground">
          {glance.label ?? t('field.pathwayFallback', { defaultValue: 'Zorgpad' })}
        </span>
        {glance.phaseName ? (
          <span className="truncate text-xs text-foreground-muted">· {glance.phaseName}</span>
        ) : null}
        {glance.state === 'paused' ? (
          <Badge variant="soft" className="shrink-0 text-[10px]">
            {t('timeline.state.paused', { defaultValue: 'Gepauzeerd' })}
          </Badge>
        ) : null}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-foreground-muted">
          {glance.done}/{glance.total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
