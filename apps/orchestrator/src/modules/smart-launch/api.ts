import FHIR from 'fhirclient'
import type Client from 'fhirclient/lib/Client'
import type { fhirclient } from 'fhirclient/lib/types'

import type { LaunchSearch } from './schemas'
import { useLaunchStore, type SmartCtx } from './store'

export class SmartLaunchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SmartLaunchError'
  }
}

export class SmartExchangeError extends Error {
  override readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'SmartExchangeError'
    this.cause = cause
  }
}

const PKCE_STORAGE_PREFIX = 'smart-pkce'

function getClientId(): string {
  const value = import.meta.env.VITE_SMART_CLIENT_ID
  if (typeof value !== 'string' || value.length === 0) {
    throw new SmartLaunchError('VITE_SMART_CLIENT_ID is not configured')
  }
  return value
}

function getRedirectUri(): string {
  return `${window.location.origin}/launch/callback`
}

function getScopes(): string {
  // Reason: minimum scope set the orchestrator needs across surfaces. Step 7
  // can switch to per-feature scopes from `getRequiredScopes()`.
  return 'launch openid fhirUser offline_access patient/*.read'
}

export async function beginLaunch(search: LaunchSearch): Promise<void> {
  useLaunchStore.getState().setFromSearch(search)
  await FHIR.oauth2.authorize({
    iss: search.iss,
    launch: search.launch,
    clientId: getClientId(),
    scope: getScopes(),
    redirectUri: getRedirectUri(),
    pkceMode: 'required',
  })
}

function deriveCtx(state: fhirclient.ClientState | undefined): SmartCtx {
  const token = state?.tokenResponse
  if (!token) return {}
  const ctx: { -readonly [K in keyof SmartCtx]: SmartCtx[K] } = {}
  if (typeof token.patient === 'string') {
    ctx.patient = { id: token.patient, reference: `Patient/${token.patient}` }
  }
  if (typeof token.encounter === 'string') {
    ctx.encounter = { id: token.encounter, reference: `Encounter/${token.encounter}` }
  }
  const fhirUser = typeof token.fhirUser === 'string' ? token.fhirUser : undefined
  if (fhirUser !== undefined) {
    const [resource, id] = fhirUser.split('/')
    if (resource !== undefined && id !== undefined) {
      ctx.user = { id, reference: fhirUser }
    }
  }
  return ctx
}

function clearPkceState(): void {
  if (typeof window === 'undefined') return
  const storage = window.sessionStorage
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i)
    if (key !== null && key.startsWith(PKCE_STORAGE_PREFIX)) {
      storage.removeItem(key)
    }
  }
}

export async function exchangeAuthCode(): Promise<{
  client: Client
  token: fhirclient.TokenResponse
  ctx: SmartCtx
}> {
  try {
    const client = await FHIR.oauth2.ready()
    const token = client.state.tokenResponse
    if (!token) {
      throw new SmartExchangeError('token response missing after exchange', null)
    }
    const ctx = deriveCtx(client.state)
    useLaunchStore.getState().setSession({ client, token, ctx })
    return { client, token, ctx }
  } catch (error) {
    if (error instanceof SmartExchangeError) throw error
    throw new SmartExchangeError('PKCE token exchange failed', error)
  } finally {
    clearPkceState()
  }
}
