import { Link } from '@tanstack/react-router'
import { ArrowUpRight, AtSign } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { initials } from '@/lib/utils/initials'
import { usePatient } from '@/modules/patient/hooks'
import { ageFromBirthDate, pickInsz } from '@/modules/patient/patientFacts'
import { RoleBadge } from '@/modules/user/components/RoleBadge'
import { useUserDetail } from '@/modules/user/hooks'

/** Identifies the person an avatar represents, so a hover card can fetch + show
 *  the right detail. `patient` resolves demographics; `user` resolves a
 *  caregiver/admin. */
export type PersonRef = { kind: 'patient'; id: string } | { kind: 'user'; id: string }

export interface PersonHoverCardProps {
  person: PersonRef
  /** Fallback name shown immediately (before/without a successful fetch). */
  name: string
}

/** Compact at-a-glance card shown when hovering a `PersonAvatar`. Lazily fetches
 *  the person (only mounts inside the tooltip content, i.e. on open). */
export function PersonHoverCard({ person, name }: PersonHoverCardProps): ReactElement {
  return person.kind === 'patient' ? (
    <PatientHover patientId={person.id} name={name} />
  ) : (
    <UserHover userId={person.id} name={name} />
  )
}

function Header({
  id,
  name,
  sub,
}: {
  id: string
  name: string
  sub?: string | undefined
}): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="md" tintBy={id}>
        <AvatarFallback tinted>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        {sub ? <span className="truncate text-xs text-foreground-muted">{sub}</span> : null}
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-xs text-foreground">{children}</span>
    </div>
  )
}

function PatientHover({ patientId, name }: { patientId: string; name: string }): ReactElement {
  const { t, i18n } = useTranslation(['patient-profile'])
  const { data: patient } = usePatient(patientId)

  const fullName = patient ? `${patient.family_name}, ${patient.given_name}` : name
  const gender = patient ? t(`gender.${patient.gender}`, { defaultValue: patient.gender }) : undefined
  const age = patient ? ageFromBirthDate(patient.birth_date) : null
  const insz = patient ? pickInsz(patient.identifiers ?? []) : null

  return (
    <div className="flex w-64 flex-col gap-3">
      <Header id={patientId} name={fullName} sub={gender} />
      {patient ? (
        <div className="grid grid-cols-2 gap-2">
          <Fact label={t('field.birthDate', { defaultValue: 'Geboortedatum' })}>
            {age !== null
              ? `${formatDateOrDash(patient.birth_date ?? null, i18n.language)} (${age} j.)`
              : formatDateOrDash(patient.birth_date ?? null, i18n.language)}
          </Fact>
          <Fact label="INSZ">{insz ? <span className="font-mono">{insz}</span> : '—'}</Fact>
        </div>
      ) : null}
      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/patients/$patientId" params={{ patientId }}>
          {t('openPatient', { defaultValue: 'Open patiënt' })}
          <ArrowUpRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}

function UserHover({ userId, name }: { userId: string; name: string }): ReactElement {
  const { data: user } = useUserDetail(userId)

  return (
    <div className="flex w-60 flex-col gap-3">
      <Header id={userId} name={user?.display_name ?? name} />
      {user ? (
        <div className="flex flex-col gap-2">
          <div>
            <RoleBadge roleId={user.role_id} withIcon />
          </div>
          <span className="flex items-center gap-1.5 truncate text-xs text-foreground-muted">
            <AtSign className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{user.email}</span>
          </span>
        </div>
      ) : null}
    </div>
  )
}
