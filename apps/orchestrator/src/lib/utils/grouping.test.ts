import { describe, expect, it } from 'vitest'

import { groupConsecutiveByDay } from './grouping'

type Row = { id: string; at: string | null }

const iso = (r: Row): string | null => r.at

describe('groupConsecutiveByDay', () => {
  it('returns no groups for an empty list', () => {
    expect(groupConsecutiveByDay<Row>([], iso)).toEqual([])
  })

  it('collapses consecutive same-day items into one group', () => {
    const rows: Row[] = [
      { id: 'a', at: '2026-06-01T08:00:00Z' },
      { id: 'b', at: '2026-06-01T20:00:00Z' },
      { id: 'c', at: '2026-06-02T09:00:00Z' },
    ]
    const groups = groupConsecutiveByDay(rows, iso)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.items.map((r) => r.id)).toEqual(['a', 'b'])
    expect(groups[1]!.items.map((r) => r.id)).toEqual(['c'])
  })

  it('does NOT merge non-consecutive runs of the same day', () => {
    const rows: Row[] = [
      { id: 'a', at: '2026-06-01T08:00:00Z' },
      { id: 'b', at: '2026-06-02T08:00:00Z' },
      { id: 'c', at: '2026-06-01T08:00:00Z' },
    ]
    // Input is intentionally unordered: the helper only collapses ADJACENT
    // same-day items, so this yields three separate groups.
    expect(groupConsecutiveByDay(rows, iso)).toHaveLength(3)
  })

  it('collapses null dates under the `none` key', () => {
    const rows: Row[] = [
      { id: 'a', at: null },
      { id: 'b', at: null },
    ]
    const groups = groupConsecutiveByDay(rows, iso)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.key).toBe('none')
  })
})
