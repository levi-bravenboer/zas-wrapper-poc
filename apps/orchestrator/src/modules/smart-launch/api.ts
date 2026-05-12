export class SmartLaunchNotImplementedError extends Error {
  constructor() {
    super('not-implemented')
    this.name = 'SmartLaunchNotImplementedError'
  }
}

export type ExchangeAuthCodeInput = {
  code: string
  state: string
}

export type ExchangedToken = {
  accessToken: string
  expiresAt: string
  patient?: string
  encounter?: string
}

export async function exchangeAuthCode(_input: ExchangeAuthCodeInput): Promise<ExchangedToken> {
  throw new SmartLaunchNotImplementedError()
}
