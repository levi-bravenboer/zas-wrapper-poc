import type Client from 'fhirclient/lib/Client'
import type { fhirclient } from 'fhirclient/lib/types'

export type SmartCtx = {
  readonly patient?: { readonly id: string; readonly reference: string }
  readonly encounter?: { readonly id: string; readonly reference: string }
  readonly user?: { readonly id: string; readonly reference: string }
}

export type LaunchContext = {
  readonly iss: string
  readonly launch: string
  readonly surface: 'smart' | 'embed'
  readonly returnPath: string | null
  readonly client: Client | null
  readonly token: fhirclient.TokenResponse | null
  readonly ctx: SmartCtx
}
