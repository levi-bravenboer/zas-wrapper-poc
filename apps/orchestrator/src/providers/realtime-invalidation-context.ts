import * as React from 'react'

export interface RealtimeEvent {
  resource: string
  action: 'upsert' | 'delete'
  id: string | null
  v: number
}

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'offline'

export interface RealtimeInvalidationContextValue {
  register: (topic: string, queryKeys: ReadonlyArray<readonly unknown[]>) => () => void
  status: RealtimeStatus
}

const noopRegister: RealtimeInvalidationContextValue['register'] = () => () => undefined

export const RealtimeInvalidationContext = React.createContext<RealtimeInvalidationContextValue>({
  register: noopRegister,
  status: 'idle',
})

export function useRealtimeInvalidation(): RealtimeInvalidationContextValue {
  return React.useContext(RealtimeInvalidationContext)
}
