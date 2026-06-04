import { requestAuthed } from '@/lib/api'

import type { LoginInput, PatientSession } from './types'

type LoginResponse = {
  session: PatientSession
}

export async function login(
  input: LoginInput
): Promise<{ session: PatientSession }> {
  return requestAuthed<LoginResponse>('/mobile/auth/login/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function me(): Promise<PatientSession> {
  return requestAuthed<PatientSession>('/mobile/auth/me')
}
