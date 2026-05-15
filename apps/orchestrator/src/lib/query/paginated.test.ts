import { describe, expect, it } from 'vitest'

import { paginatedQueryKey, type ListQuery } from './paginated'

describe('paginatedQueryKey', () => {
  it('produces deep-equal keys when top-level fields are inserted in different order', () => {
    const a: ListQuery = {
      page: 2,
      page_size: 25,
      q: 'lev',
      order_by: 'name',
      order: 'asc',
    }
    const b: ListQuery = {
      order: 'asc',
      order_by: 'name',
      q: 'lev',
      page_size: 25,
      page: 2,
    }

    expect(paginatedQueryKey('/patients', a)).toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces deep-equal keys when filter fields are inserted in different order', () => {
    const a: ListQuery = {
      filters: {
        status: { op: 'eq', value: 'active' },
        owner_id: { op: 'in', value: ['u1', 'u2'] },
      },
    }
    const b: ListQuery = {
      filters: {
        owner_id: { op: 'in', value: ['u1', 'u2'] },
        status: { op: 'eq', value: 'active' },
      },
    }

    expect(paginatedQueryKey('/patients', a)).toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces deep-equal keys when filter value arrays are in different order', () => {
    const a: ListQuery = {
      filters: { owner_id: { op: 'in', value: ['u2', 'u1', 'u3'] } },
    }
    const b: ListQuery = {
      filters: { owner_id: { op: 'in', value: ['u3', 'u1', 'u2'] } },
    }

    expect(paginatedQueryKey('/patients', a)).toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces deep-equal keys when multiple operators on one field appear in different order', () => {
    const a: ListQuery = {
      filters: {
        created_at: [
          { op: 'gte', value: '2026-01-01' },
          { op: 'lte', value: '2026-12-31' },
        ],
      },
    }
    const b: ListQuery = {
      filters: {
        created_at: [
          { op: 'lte', value: '2026-12-31' },
          { op: 'gte', value: '2026-01-01' },
        ],
      },
    }

    expect(paginatedQueryKey('/patients', a)).toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces NOT deep-equal keys when the page differs', () => {
    const a: ListQuery = { page: 1 }
    const b: ListQuery = { page: 2 }
    expect(paginatedQueryKey('/patients', a)).not.toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces NOT deep-equal keys when the search string differs', () => {
    const a: ListQuery = { q: 'foo' }
    const b: ListQuery = { q: 'bar' }
    expect(paginatedQueryKey('/patients', a)).not.toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces NOT deep-equal keys when a filter value differs', () => {
    const a: ListQuery = { filters: { status: { op: 'eq', value: 'active' } } }
    const b: ListQuery = { filters: { status: { op: 'eq', value: 'archived' } } }
    expect(paginatedQueryKey('/patients', a)).not.toEqual(paginatedQueryKey('/patients', b))
  })

  it('produces NOT deep-equal keys when the path differs', () => {
    const q: ListQuery = { page: 1 }
    expect(paginatedQueryKey('/patients', q)).not.toEqual(paginatedQueryKey('/doctors', q))
  })
})
