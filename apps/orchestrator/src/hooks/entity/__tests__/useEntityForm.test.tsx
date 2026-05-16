import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { useEntityForm } from '../useEntityForm'

const schema = z.object({ name: z.string().min(1, 'verplicht') })
type Values = z.infer<typeof schema>

describe('useEntityForm', () => {
  it('flags isDirty when a field changes', () => {
    const { result } = renderHook(() =>
      useEntityForm<Values>({
        schema,
        defaultValues: { name: '' },
        onSubmit: async () => {},
      }),
    )
    expect(result.current.isDirty).toBe(false)
    act(() => {
      result.current.form.setFieldValue('name', 'hello')
    })
    expect(result.current.isDirty).toBe(true)
  })

  it('chains onSubmit then onSuccess on resolve', async () => {
    const onSubmit = vi.fn(async () => {})
    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      useEntityForm<Values>({
        schema,
        defaultValues: { name: 'ok' },
        onSubmit,
        onSuccess,
      }),
    )
    await act(async () => {
      await result.current.submit()
    })
    expect(onSubmit).toHaveBeenCalledWith({ name: 'ok' })
    expect(onSuccess).toHaveBeenCalledWith({ name: 'ok' })
  })

  it('skips onSuccess when onSubmit rejects', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('boom')
    })
    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      useEntityForm<Values>({
        schema,
        defaultValues: { name: 'ok' },
        onSubmit,
        onSuccess,
      }),
    )
    await act(async () => {
      await result.current.submit()
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('Zod schema produces field-level error on submit', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useEntityForm<Values>({
        schema,
        defaultValues: { name: '' },
        onSubmit,
      }),
    )
    await act(async () => {
      await result.current.submit()
    })
    await waitFor(() => {
      const errors = result.current.form.getFieldMeta('name')?.errors ?? []
      expect(errors.length).toBeGreaterThan(0)
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
