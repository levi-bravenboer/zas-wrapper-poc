import { createContext, useContext, type ReactNode } from 'react'

const MISSING: unique symbol = Symbol('port:missing')
type Missing = typeof MISSING

export type Port<T> = {
  readonly name: string
  readonly Provider: (props: { value: T; children: ReactNode }) => ReactNode
  readonly use: () => T
}

export function createPort<T>(name: string): Port<T> {
  const Context = createContext<T | Missing>(MISSING)
  Context.displayName = `${name}Port`

  function Provider({ value, children }: { value: T; children: ReactNode }): ReactNode {
    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  function use(): T {
    const value = useContext(Context)
    if (value === MISSING) {
      throw new Error(`${name} port missing`)
    }
    return value
  }

  return { name, Provider, use }
}
