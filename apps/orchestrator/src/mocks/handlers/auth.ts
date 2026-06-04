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

// multi-role human (REQ-NON-3): login answers requires_role_selection and
// the session stays unbound until POST /auth/session/role
const MULTI_ROLE_USER = {
  id: 'user_multi',
  email: 'hoofdarts@zas.local',
  display_name: 'Hilde Hoofdarts',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  role: 'caregiver' as const,
}
const MULTI_ROLE_ROLES = ['admin', 'caregiver'] as const

const STUB_PROVIDERS = [
  { key: 'password', label: 'E-mail + wachtwoord', kind: 'password' as const },
]

const SESSION_COOKIE = 'BACKEND_SESSION=demo; Path=/; SameSite=Strict'

let signedIn = false
let multiRoleActiveRole: 'admin' | 'caregiver' | null = null
let multiRoleSessionLive = false

export const authHandlers = [
  http.post(`${baseUrl}/auth/login/password`, async ({ request }) => {
    const body = loginBodySchema.parse(await request.json())
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { code: 'security.auth.invalid_credentials', detail: 'Missing credentials' },
        { status: 400 },
      )
    }
    if (body.email === MULTI_ROLE_USER.email && body.password === 'changeme') {
      multiRoleSessionLive = true
      multiRoleActiveRole = null
      signedIn = false
      return HttpResponse.json(
        { requires_role_selection: true, available_roles: [...MULTI_ROLE_ROLES] },
        { status: 200, headers: { 'Set-Cookie': SESSION_COOKIE } },
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
    multiRoleSessionLive = false
    multiRoleActiveRole = null
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${baseUrl}/auth/session/role`, async ({ request }) => {
    const body = z.object({ role: z.enum(['admin', 'caregiver']) }).parse(await request.json())
    if (!multiRoleSessionLive) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    multiRoleActiveRole = body.role
    return HttpResponse.json({ ...MULTI_ROLE_USER, role: body.role }, { status: 200 })
  }),

  http.get(`${baseUrl}/auth/session/roles`, () => {
    if (multiRoleSessionLive) {
      return HttpResponse.json([...MULTI_ROLE_ROLES], { status: 200 })
    }
    if (signedIn) {
      return HttpResponse.json([STUB_USER.role], { status: 200 })
    }
    return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }),

  http.get(`${baseUrl}/auth/me`, () => {
    if (multiRoleSessionLive) {
      if (multiRoleActiveRole === null) {
        return HttpResponse.json(
          {
            code: 'conflict.auth.role_selection_required',
            message: 'Select an active role for this session.',
            details: { available_roles: [...MULTI_ROLE_ROLES] },
          },
          { status: 409 },
        )
      }
      return HttpResponse.json({ ...MULTI_ROLE_USER, role: multiRoleActiveRole }, { status: 200 })
    }
    if (!signedIn) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    return HttpResponse.json(STUB_USER, { status: 200 })
  }),

  http.get(`${baseUrl}/auth/providers`, () => HttpResponse.json(STUB_PROVIDERS, { status: 200 })),
]
