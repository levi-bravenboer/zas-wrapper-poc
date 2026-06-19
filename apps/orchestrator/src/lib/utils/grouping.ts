export type DayGroup<T> = {
  /** Stable per-calendar-day key (`YYYY-M-D`, or `none` when the date is null). */
  key: string
  items: T[]
}

function calendarDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Group a list into consecutive runs that share a calendar day. Items must
 * already be ordered by date; consecutive same-day items collapse into one
 * group. Items whose date is `null` collapse under the `none` key. The caller
 * formats the group header (relative vs absolute) from the key/items.
 */
export function groupConsecutiveByDay<T>(
  items: readonly T[],
  getIso: (item: T) => string | null,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const item of items) {
    const iso = getIso(item)
    const key = iso ? calendarDayKey(iso) : 'none'
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}
