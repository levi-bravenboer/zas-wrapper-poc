import { HttpResponse, http } from 'msw'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const STUB_USER = {
  id: 'user_demo',
  email: 'demo@reaktor.local',
  displayName: 'Demo Clinician',
  roles: ['clinician'],
}

const SESSION_COOKIE = 'orchestrator-session=demo; Path=/; SameSite=Strict'

let signedIn = false

export const authHandlers = [
  http.post(`${baseUrl}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string }
    if (!body.username || !body.password) {
      return HttpResponse.json({ detail: 'Missing credentials' }, { status: 400 })
    }
    if (body.password === 'wrong') {
      return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
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
]
