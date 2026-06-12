import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

import { INFORMED_CONSENT_CHANNELS, type ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'informed_consent'>
  onChange: (next: ConfigForSemantics<'informed_consent'>) => void
}

type Channel = (typeof INFORMED_CONSENT_CHANNELS)[number]

const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  in_app: 'In-app',
}

// Pathway-completion § A8: two-actor consent lifecycle. The questions
// list defaults to a single yes/no consent question server-side; PoC
// authors edit only the first question's label here. Reminder + expiry
// timing is owned by these fields — timing_policy is forbidden for
// this kind.
export function InformedConsentInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const channels = config.channels ?? ['email', 'push']
  const firstQuestion = config.questions?.[0]

  function toggleChannel(channel: Channel) {
    const next = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel]
    if (next.length === 0) return // ≥1 channel enforced server-side too
    onChange({ ...config, channels: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <InspectorField
        label={t('inspector.informedConsent.question', { defaultValue: 'Toestemmingsvraag' })}
        htmlFor="consent-question"
      >
        <Input
          id="consent-question"
          value={firstQuestion?.label ?? ''}
          placeholder={t('inspector.informedConsent.questionPlaceholder', {
            defaultValue: 'Ik geef toestemming',
          })}
          onChange={(e) =>
            onChange({
              ...config,
              questions: [
                {
                  id: firstQuestion?.id ?? 'consent',
                  type: firstQuestion?.type ?? 'single_choice',
                  label: e.target.value,
                  required: true,
                },
              ],
            })
          }
        />
      </InspectorField>

      <InspectorField label={t('inspector.informedConsent.channels', { defaultValue: 'Kanalen' })}>
        <div className="flex flex-wrap gap-1.5">
          {INFORMED_CONSENT_CHANNELS.map((channel) => {
            const active = channels.includes(channel)
            return (
              <button
                key={channel}
                type="button"
                aria-pressed={active}
                onClick={() => toggleChannel(channel)}
                className={
                  active
                    ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary'
                    : 'rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary'
                }
              >
                {CHANNEL_LABELS[channel]}
              </button>
            )
          })}
        </div>
      </InspectorField>

      <div className="grid grid-cols-2 gap-3">
        <InspectorField
          label={t('inspector.informedConsent.reminderOffset', {
            defaultValue: 'Herinnering elke',
          })}
          htmlFor="consent-reminder-offset"
        >
          <Input
            id="consent-reminder-offset"
            value={config.reminder_offset_iso ?? 'P3D'}
            placeholder="P3D"
            onChange={(e) =>
              onChange({ ...config, reminder_offset_iso: e.target.value || undefined })
            }
          />
        </InspectorField>
        <InspectorField
          label={t('inspector.informedConsent.reminderMax', { defaultValue: 'Max herinneringen' })}
          htmlFor="consent-reminder-max"
        >
          <Input
            id="consent-reminder-max"
            type="number"
            min={0}
            max={10}
            value={config.reminder_max ?? 3}
            onChange={(e) =>
              onChange({
                ...config,
                reminder_max: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </InspectorField>
      </div>

      <InspectorField
        label={t('inspector.informedConsent.expiresAt', { defaultValue: 'Verloopt na' })}
        htmlFor="consent-expires"
      >
        <Input
          id="consent-expires"
          value={config.expires_at_iso ?? ''}
          placeholder={t('inspector.informedConsent.expiresAtPlaceholder', {
            defaultValue: 'Bijv. P30D — leeg = nooit',
          })}
          onChange={(e) => onChange({ ...config, expires_at_iso: e.target.value || null })}
        />
      </InspectorField>
      <p className="text-[11px] text-muted-foreground">
        {t('inspector.informedConsent.lifecycleHint', {
          defaultValue:
            'ISO 8601 duur (P3D = 3 dagen, PT4H = 4 uur). Herinneringen stoppen zodra de patiënt tekent; bij verlopen sluit het blok met "geen toestemming".',
        })}
      </p>
    </div>
  )
}
