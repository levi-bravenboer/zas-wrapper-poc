import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createPort } from '@/platform/ports/createPort'

type TasksPort = {
  readonly list: () => readonly string[]
}

describe('createPort', () => {
  it('returns a typed value when consumed inside a Provider', () => {
    const port = createPort<TasksPort>('Tasks')
    const value: TasksPort = { list: () => ['one', 'two'] }
    const { result } = renderHook(() => port.use(), {
      wrapper: ({ children }) => <port.Provider value={value}>{children}</port.Provider>,
    })
    expect(result.current.list()).toEqual(['one', 'two'])
  })

  it('throws when consumed outside a Provider', () => {
    const port = createPort<TasksPort>('Tasks')
    expect(() => renderHook(() => port.use())).toThrow('Tasks port missing')
  })
})
