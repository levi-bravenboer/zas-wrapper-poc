import type Client from 'fhirclient/lib/Client'
import type { fhirclient } from 'fhirclient/lib/types'

export function makeFhirClient(
  state: Partial<fhirclient.ClientState> = { tokenResponse: {} },
): Client {
  // Test stub for fhirclient Client class. Production code reads `state.tokenResponse`
  // and `state` only — see modules/smart-launch/api.ts. Cast is isolated here so
  // consumers receive a typed Client without per-call assertions.
  return { state } as unknown as Client
}

export function makeTokenResponse(
  partial: Partial<fhirclient.TokenResponse> = {},
): fhirclient.TokenResponse {
  return { access_token: 'tok', token_type: 'bearer', ...partial }
}
