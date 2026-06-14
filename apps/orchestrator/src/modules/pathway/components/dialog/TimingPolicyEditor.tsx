import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { TimingPolicyValue } from '../../types'

// Pathway-completion § C4.6: tagged-union timing_policy editor.
// Variants mirror `app/domain/pathway/timing.py`; the dialog hides this
// section entirely for kinds whose validator forbids timing
// (start / end_pathway / informed_consent).

const POLICY_KINDS = [
  'none',
  'fixed_duration',
  'wait_after',
  'due_within',
  'at_enrollment_picked_date',
] as const

type PolicyKindOption = (typeof POLICY_KINDS)[number]

function kindOf(value: TimingPolicyValue): PolicyKindOption {
  if (!value) return 'none'
  return value.kind as PolicyKindOption
}

function isoOf(value: TimingPolicyValue): string {
  if (!value) return ''
  const v = value as Record<string, unknown>
  if (typeof v.duration_iso === 'string') return v.duration_iso
  if (typeof v.offset_iso === 'string') return v.offset_iso
  if (typeof v.window_iso === 'string') return v.window_iso
  return ''
}

function buildPolicy(kind: PolicyKindOption, iso: string): TimingPolicyValue {
  switch (kind) {
    case 'none':
      return null
    case 'fixed_duration':
      return { kind: 'fixed_duration', duration_iso: iso || 'P1D' } as NonNullable<TimingPolicyValue>
    case 'wait_after':
      return { kind: 'wait_after', offset_iso: iso || 'PT0S' } as NonNullable<TimingPolicyValue>
    case 'due_within':
      return { kind: 'due_within', window_iso: iso || 'P7D' } as NonNullable<TimingPolicyValue>
    case 'at_enrollment_picked_date':
      return { kind: 'at_enrollment_picked_date' } as NonNullable<TimingPolicyValue>
  }
}

type Props = {
  value: TimingPolicyValue
  onChange: (next: TimingPolicyValue) => void
}

export function TimingPolicyEditor({ value, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const kind = kindOf(value)
  const iso = isoOf(value)
  const needsIso = kind === 'fixed_duration' || kind === 'wait_after' || kind === 'due_within'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={kind}
          onValueChange={(next) => onChange(buildPolicy(next as PolicyKindOption, iso))}
        >
          <SelectTrigger className="h-8 flex-1 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POLICY_KINDS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`timingPolicy.kind.${option}`, {
                  defaultValue:
                    option === 'none'
                      ? 'Geen timing'
                      : option === 'fixed_duration'
                        ? 'Vaste duur'
                        : option === 'wait_after'
                          ? 'Wacht na startmoment'
                          : option === 'due_within'
                            ? 'Af te ronden binnen'
                            : 'Datum gekozen bij inschrijving',
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {needsIso && (
          <Input
            aria-label={t('timingPolicy.isoLabel', { defaultValue: 'ISO 8601 duur' })}
            value={iso}
            placeholder={kind === 'wait_after' ? 'PT0S' : 'P1D'}
            onChange={(e) => onChange(buildPolicy(kind, e.target.value))}
            className="h-8 w-[120px] text-[12px]"
          />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t('timingPolicy.hint', {
          defaultValue: 'ISO 8601 duur: P1D = 1 dag, PT4H = 4 uur, P2W = 2 weken.',
        })}
      </p>
    </div>
  )
}
