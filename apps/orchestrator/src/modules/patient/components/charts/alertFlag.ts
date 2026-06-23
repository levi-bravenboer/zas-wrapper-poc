/**
 * Maps Luscii's OWN fired alert flag (passed through verbatim by the backend,
 * never computed — see openspec/mdr-watchlist.md 2026-06-22) onto an
 * orchestrator semantic colour token.
 *
 * Display-only: this is a colour lookup, not a clinical judgement. `red` and
 * `orange` are the flags observed on the Luscii sandbox; any other non-empty
 * flag still renders as flagged (warning) so a real alert is never silently
 * dropped, while `null`/empty means "no alert".
 */
export type AlertSeverity = 'critical' | 'warning'

export function alertSeverity(flag: string | null | undefined): AlertSeverity | null {
  if (!flag) return null
  const normalised = flag.trim().toLowerCase()
  if (!normalised) return null
  if (normalised === 'red') return 'critical'
  return 'warning'
}

/** CSS colour for an alert flag, or `null` when the point carries no alert. */
export function alertColor(flag: string | null | undefined): string | null {
  const severity = alertSeverity(flag)
  if (severity === null) return null
  return severity === 'critical' ? 'var(--color-destructive)' : 'var(--color-warning)'
}
