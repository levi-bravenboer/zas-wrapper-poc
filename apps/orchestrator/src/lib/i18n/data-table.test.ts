import { describe, expect, it } from 'vitest'

import { i18n } from './index'

const REQUIRED_KEYS = [
  'empty.title',
  'empty.body',
  'pagination.previous',
  'pagination.next',
  'pagination.indicator',
  'pagination.pageSize',
  'toolbar.search.placeholder',
  'toolbar.filters.clear',
  'toolbar.filters.button',
  'sort.ariaAscending',
  'sort.ariaDescending',
  'sort.ariaNone',
  'bulk.count.one',
  'bulk.count.other',
  'bulk.cancel',
  'expand.toggle',
  'actions.menu.aria',
  'realtime.offline',
] as const

describe('data-table i18n namespace', () => {
  it.each(REQUIRED_KEYS)('resolves %s', (key) => {
    const resolved = i18n.t(key, { ns: 'data-table' })
    expect(resolved).not.toBe(key)
    expect(typeof resolved).toBe('string')
    expect((resolved as string).length).toBeGreaterThan(0)
  })

  it('interpolates the pagination indicator', () => {
    expect(i18n.t('pagination.indicator', { ns: 'data-table', page: 2, total: 7 })).toBe('2 / 7')
  })

  it('interpolates the bulk count plural variants', () => {
    expect(i18n.t('bulk.count.one', { ns: 'data-table', count: 1 })).toBe('1 geselecteerd')
    expect(i18n.t('bulk.count.other', { ns: 'data-table', count: 3 })).toBe('3 geselecteerd')
  })
})
