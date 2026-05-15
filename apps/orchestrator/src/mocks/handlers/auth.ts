import { HttpResponse, http } from 'msw'
import { z } from 'zod'

import { env } from '@/config/env'

const loginBodySchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
})

const baseUrl = env.API_BASE_URL

const STUB_USER = {
  id: 'user_demo',
  email: 'demo@reaktor.local',
  displayName: 'Demo Clinician',
  roles: ['clinician'],
}

// PoC mock mode: LoginForm seeds the session cache client-side and bypasses
// `/auth/login` entirely (see modules/auth/components/LoginForm.tsx). To keep
// `_auth/*` routes reachable across hard refreshes, `/auth/me` unconditionally
// returns the stub user. Real round-trip auth lands under BL-035.
export const authHandlers = [
  http.post(`${baseUrl}/auth/login`, async ({ request }) => {
    const body = loginBodySchema.parse(await request.json())
    if (!body.username || !body.password) {
      return HttpResponse.json({ detail: 'Missing credentials' }, { status: 400 })
    }
    if (body.password === 'wrong') {
      return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
    }
    return HttpResponse.json(STUB_USER, { status: 200 })
  }),

  http.post(`${baseUrl}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(STUB_USER, { status: 200 })),
]
