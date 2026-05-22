import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { useUserColumns, useUserFilterDefs, useUserRowActions } from './UserColumns'

function I18nWrap({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

function FullWrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
}

const ADMIN = {
  id: 'a',
  email: 'a@x',
  display_name: 'A',
  role: 'admin' as const,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

describe('useUserColumns', () => {
  it('exposes sort + filter metadata aligned with backend repo', () => {
    const { result } = renderHook(() => useUserColumns(), { wrapper: I18nWrap })
    const byId = Object.fromEntries(result.current.map((c) => [c.id, c]))
    expect(byId.display_name?.sortKey).toBe('display_name')
    expect(byId.role?.filterKey).toBe('role')
    expect(byId.is_active?.filterKey).toBe('is_active')
    expect(byId.created_at?.sortKey).toBe('created_at')
  })
})

describe('useUserFilterDefs', () => {
  it('produces role multi + is_active boolean with full enum values', () => {
    const { result } = renderHook(() => useUserFilterDefs(), { wrapper: I18nWrap })
    const role = result.current.find((d) => d.key === 'role')
    expect(role?.type).toBe('multi')
    const roleOptions = role && role.type === 'multi' ? role.options.map((o) => o.value).sort() : []
    expect(roleOptions).toEqual(['admin', 'caregiver'])
    const active = result.current.find((d) => d.key === 'is_active')
    expect(active?.type).toBe('boolean')
  })
})

describe('useUserRowActions', () => {
  it('returns view-only when actor equals row id', () => {
    const { result } = renderHook(
      () => useUserRowActions({ currentUserId: 'a', onView: () => undefined }),
      { wrapper: FullWrap },
    )
    const actions = result.current(ADMIN)
    expect(actions).toHaveLength(1)
  })

  it('offers demote + deactivate for an active admin row when actor differs', () => {
    const { result } = renderHook(
      () => useUserRowActions({ currentUserId: 'me', onView: () => undefined }),
      { wrapper: FullWrap },
    )
    const actions = result.current(ADMIN)
    expect(actions).toHaveLength(3)
    expect(actions.some((a) => a.destructive)).toBe(true)
  })
})
