import { act, renderHook } from '@testing-library/react'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { useLocale } from './useLocale'

import { i18n } from './index'

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

describe('useLocale', () => {
  it('returns the current locale', () => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    expect(result.current.locale).toBe('nl')
  })

  it('changes the locale through i18next', async () => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    await act(async () => {
      await result.current.changeLocale('en')
    })
    expect(i18n.language).toBe('en')
    await act(async () => {
      await result.current.changeLocale('nl')
    })
  })
})
