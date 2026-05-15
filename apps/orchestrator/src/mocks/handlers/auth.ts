import { HttpResponse, http } from 'msw'
import { z } from 'zod'

import { env } from '@/config/env'

const loginBodySchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
})

const baseUrl = env.API_BASE_URL

const STUB_USER = {
  id: 'user_demo',
  email: 'caregiver@zas.local',
  display_name: 'Demo Caregiver',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  role: 'caregiver' as const,
}

const STUB_PROVIDERS = [
  { key: 'password', label: 'E-mail + wachtwoord', kind: 'password' as const },
]

const SESSION_COOKIE = 'BACKEND_SESSION=demo; Path=/; SameSite=Strict'

let signedIn = false

export const authHandlers = [
  http.post(`${baseUrl}/auth/login/password`, async ({ request }) => {
    const body = loginBodySchema.parse(await request.json())
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { code: 'security.auth.invalid_credentials', detail: 'Missing credentials' },
        { status: 400 },
      )
    }
    if (body.email !== STUB_USER.email || body.password !== 'changeme') {
      return HttpResponse.json(
        { code: 'security.auth.invalid_credentials', detail: 'Invalid credentials' },
        { status: 401 },
      )
    }
    signedIn = true
    return HttpResponse.json(STUB_USER, {
      status: 200,
      headers: { 'Set-Cookie': SESSION_COOKIE },
    })
  }),

  http.post(`${baseUrl}/auth/logout`, () => {
    signedIn = false
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${baseUrl}/auth/me`, () => {
    if (!signedIn) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    return HttpResponse.json(STUB_USER, { status: 200 })
  }),

  http.get(`${baseUrl}/auth/providers`, () => HttpResponse.json(STUB_PROVIDERS, { status: 200 })),
]
