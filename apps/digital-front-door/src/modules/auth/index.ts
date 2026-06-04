import { getDefaultStore } from 'jotai'

import { requestAuthed } from '@/lib/api'
import { log } from '@/lib/logger'
import { queryClient } from '@/lib/query-client'

import { currentSessionAtom } from './atoms'
import { authQueries } from './queries'

export { currentSessionAtom } from './atoms'
export { useLogin } from './hooks/use-login'
export { useSession } from './hooks/use-session'
export { authMutations } from './mutations'
export { authQueries } from './queries'
export type { LoginInput, PatientSession } from './types'

/**
 * Full logout: call the shared backend endpoint, clear the session atom,
 * and invalidate the `me` query so the routing gate redirects to login.
 *
 * Shipped now so the convention has a first concrete implementation.
 * The in-app button lands in a future change once a nav surface exists.
 */
export async function resetAuth(): Promise<void> {
  await requestAuthed('/auth/logout', { method: 'POST' }).catch(
    (err: unknown) => {
      log.warn('[auth] logout request failed', err)
    }
  )
  getDefaultStore().set(currentSessionAtom, null)
  await queryClient.invalidateQueries({ queryKey: authQueries.all() })
}
