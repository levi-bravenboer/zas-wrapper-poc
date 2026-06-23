import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { alertSeverity } from './alertFlag'

export interface AlertDotProps {
  flag: string | null | undefined
}

/**
 * Leading status dot for list-row renderers (categorical / free-text /
 * unknown). Coloured by Luscii's own fired alert flag (passthrough). Renders
 * a neutral placeholder dot when no alert so rows stay vertically aligned.
 */
export function AlertDot({ flag }: AlertDotProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const severity = alertSeverity(flag)
  const color =
    severity === 'critical'
      ? 'var(--color-destructive)'
      : severity === 'warning'
        ? 'var(--color-warning)'
        : 'var(--color-border)'
  const label =
    severity === 'critical'
      ? t('replica.alert.critical')
      : severity === 'warning'
        ? t('replica.alert.warning')
        : undefined
  return (
    <span
      data-testid="alert-dot"
      data-severity={severity ?? 'none'}
      className="mt-1.5 size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  )
}
