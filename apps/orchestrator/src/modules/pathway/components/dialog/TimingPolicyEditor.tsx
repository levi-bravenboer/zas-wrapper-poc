import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

import type { TimingPolicyValue } from '../../types'

import { OptionsSelect } from './OptionsSelect'

// Pathway-completion § C4.6: tagged-union `timing_policy` editor.
// Variants mirror `app/domain/pathway/timing.py`. Adding a kind = one
// `POLICY_META` entry.

type PolicyMeta = {
  /** Object key on the policy carrying its iso-8601 duration. `null`
   *  when the kind has no extra payload (e.g. `at_enrollment_picked_date`). */
  isoField: 'duration_iso' | 'offset_iso' | 'window_iso' | null
  defaultIso: string | null
  placeholder: string
  labelFallback: string
}

const POLICY_META = {
  none: {
    isoField: null,
    defaultIso: null,
    placeholder: '',
    labelFallback: 'Geen timing',
  },
  fixed_duration: {
    isoField: 'duration_iso',
    defaultIso: 'P1D',
    placeholder: 'P1D',
    labelFallback: 'Vaste duur',
  },
  wait_after: {
    isoField: 'offset_iso',
    defaultIso: 'PT0S',
    placeholder: 'PT0S',
    labelFallback: 'Wacht na startmoment',
  },
  due_within: {
    isoField: 'window_iso',
    defaultIso: 'P7D',
    placeholder: 'P1D',
    labelFallback: 'Af te ronden binnen',
  },
  at_enrollment_picked_date: {
    isoField: null,
    defaultIso: null,
    placeholder: '',
    labelFallback: 'Datum gekozen bij inschrijving',
  },
  relative_to_date: {
    isoField: 'offset_iso',
    defaultIso: 'PT0S',
    placeholder: 'P2D',
    labelFallback: 'Relatief tot klinische datum',
  },
} as const satisfies Record<string, PolicyMeta>

const DIRECTIONS = ['before', 'after'] as const
type Direction = (typeof DIRECTIONS)[number]

type PolicyKind = keyof typeof POLICY_META

const POLICY_KINDS = Object.keys(POLICY_META) as PolicyKind[]

function kindOf(value: TimingPolicyValue): PolicyKind {
  if (!value) return 'none'
  return value.kind as PolicyKind
}

function isoOf(value: TimingPolicyValue): string {
  if (!value) return ''
  const field = POLICY_META[kindOf(value)].isoField
  if (!field) return ''
  const raw = (value as Record<string, unknown>)[field]
  return typeof raw === 'string' ? raw : ''
}

function dateNameOf(value: TimingPolicyValue): string {
  const raw = (value as Record<string, unknown> | null)?.date_name
  return typeof raw === 'string' ? raw : ''
}

function directionOf(value: TimingPolicyValue): Direction {
  const raw = (value as Record<string, unknown> | null)?.direction
  return raw === 'after' ? 'after' : 'before'
}

function buildPolicy(
  kind: PolicyKind,
  iso: string,
  relative?: { dateName: string; direction: Direction },
): TimingPolicyValue {
  if (kind === 'none') return null
  const meta = POLICY_META[kind]
  const next: Record<string, unknown> = { kind }
  if (meta.isoField) next[meta.isoField] = iso || meta.defaultIso || ''
  if (kind === 'relative_to_date') {
    next.date_name = relative?.dateName ?? ''
    next.direction = relative?.direction ?? 'before'
  }
  return next as NonNullable<TimingPolicyValue>
}

type Props = {
  value: TimingPolicyValue
  onChange: (next: TimingPolicyValue) => void
}

export function TimingPolicyEditor({ value, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const kind = kindOf(value)
  const meta = POLICY_META[kind]
  const iso = isoOf(value)
  const dateName = dateNameOf(value)
  const direction = directionOf(value)
  const relative = { dateName, direction }

  const kindOptions = POLICY_KINDS.map((option) => ({
    value: option,
    label: t(`timingPolicy.kind.${option}`, { defaultValue: POLICY_META[option].labelFallback }),
  }))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <OptionsSelect
          value={kind}
          options={kindOptions}
          onChange={(next) => onChange(buildPolicy(next as PolicyKind, iso, relative))}
          triggerClassName="h-8 flex-1 text-[12px]"
        />
        {meta.isoField && (
          <Input
            aria-label={t('timingPolicy.isoLabel', { defaultValue: 'ISO 8601 duur' })}
            value={iso}
            placeholder={meta.placeholder}
            onChange={(e) => onChange(buildPolicy(kind, e.target.value, relative))}
            className="h-8 w-[120px] text-[12px]"
          />
        )}
      </div>
      {kind === 'relative_to_date' && (
        <div className="flex items-center gap-2">
          <Input
            aria-label={t('timingPolicy.dateNameLabel', { defaultValue: 'Klinische datum' })}
            value={dateName}
            placeholder={t('timingPolicy.dateNamePlaceholder', { defaultValue: 'operation_date' })}
            onChange={(e) =>
              onChange(buildPolicy(kind, iso, { dateName: e.target.value, direction }))
            }
            className="h-8 flex-1 text-[12px]"
          />
          <OptionsSelect
            value={direction}
            options={DIRECTIONS.map((d) => ({
              value: d,
              label: t(`timingPolicy.direction.${d}`, {
                defaultValue: d === 'before' ? 'voor' : 'na',
              }),
            }))}
            onChange={(next) =>
              onChange(buildPolicy(kind, iso, { dateName, direction: next as Direction }))
            }
            triggerClassName="h-8 w-[100px] text-[12px]"
          />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t('timingPolicy.hint', {
          defaultValue: 'ISO 8601 duur: P1D = 1 dag, PT4H = 4 uur, P2W = 2 weken.',
        })}
      </p>
    </div>
  )
}
