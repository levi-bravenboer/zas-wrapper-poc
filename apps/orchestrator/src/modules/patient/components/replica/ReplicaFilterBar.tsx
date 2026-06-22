import { Calendar, Plus, Settings } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import type { LusciiWindowDays } from '../../hooks'

import { REPLICA_PRESETS } from './presets'

export interface ReplicaFilterBarProps {
  active: LusciiWindowDays
  onChange: (days: LusciiWindowDays) => void
}

/**
 * Replica of Luscii's measurement filter bar: a left "Aangepast" custom-range
 * control followed by the 7D–12M presets, and right-aligned add / view
 * affordances. The custom-range and right-side actions are visual-only for v1
 * (the backend window is days-back; custom ranges + add/view are follow-ups).
 */
export function ReplicaFilterBar({ active, onChange }: ReplicaFilterBarProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title={t('replica.filter.custom_hint')}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted"
        >
          <Calendar className="size-4" aria-hidden />
          {t('replica.filter.custom')}
        </button>
        <div
          role="group"
          aria-label={t('replica.filter.range_label')}
          className="flex items-center"
        >
          {REPLICA_PRESETS.map((preset) => {
            const isActive = preset.days === active
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onChange(preset.days)}
                aria-pressed={isActive}
                className={cn(
                  'min-w-11 px-3 py-1.5 text-sm font-medium transition-colors',
                  'border border-border first:rounded-l-md last:rounded-r-md -ml-px first:ml-0',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-surface-1 text-foreground hover:bg-surface-2',
                )}
              >
                {preset.key}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label={t('replica.filter.add')}
          title={t('replica.filter.soon')}
          className="inline-flex items-center rounded-md border border-border p-1.5 text-foreground-muted"
        >
          <Plus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          disabled
          title={t('replica.filter.soon')}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted"
        >
          <Settings className="size-4" aria-hidden />
          {t('replica.filter.view')}
        </button>
      </div>
    </div>
  )
}
